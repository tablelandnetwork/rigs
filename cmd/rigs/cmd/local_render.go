package cmd

import (
	"context"
	"fmt"
	"image/png"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/builder"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

func init() {
	localCmd.AddCommand(renderCmd)

	renderCmd.Flags().String("to-path", "./renders", "path to write the images to")
	renderCmd.Flags().String("layers-path", "./artifacts/layers", "path to the rigs layer images")
	renderCmd.Flags().Int("size", 4000, "width and height of generated images")
	renderCmd.Flags().Int("medium-size", 2000, "width and height of generated medium images")
	renderCmd.Flags().Int("thumb-size", 600, "width and height of generated thumb images")
	renderCmd.Flags().Bool("labels", false, "render metadata labels on generated images")
	renderCmd.Flags().Int("concurrency", 2, "how many concurrent workers used for rendering rig images")
}

var renderCmd = &cobra.Command{
	Use:   "render",
	Short: "Render rig imagery",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		b := builder.NewBuilder(localStore)

		rigs, err := localStore.Rigs(ctx)
		checkErr(err)

		renderExecFcn := func(rig local.Rig, opts []builder.RenderOption) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				path, err := b.Render(ctx, &rig, viper.GetString("layers-path"), viper.GetString("to-path"), opts...)
				return path, err
			}
		}

		var jobs []wpool.Job

		for _, rig := range rigs {
			opts := []builder.RenderOption{
				builder.RenderCompression(png.DefaultCompression),
				builder.RenderLabels(viper.GetBool("labels")),
				builder.RenderSize(viper.GetInt("size")),
				builder.RenderMediumSize(viper.GetInt("medium-size")),
				builder.RenderThumbSize(viper.GetInt("thumb-size")),
			}
			jobs = append(jobs, wpool.Job{
				ID:     wpool.JobID(rig.ID),
				ExecFn: renderExecFcn(rig, opts),
			})
		}

		pool := wpool.New(viper.GetInt("concurrency"), rate.Inf)
		go pool.GenerateFrom(jobs)
		go pool.Run(ctx)
		count := 1
	Loop:
		for {
			select {
			case r, ok := <-pool.Results():
				if !ok {
					continue
				}
				fmt.Printf("%d/%d. %v\n", count, len(jobs), r.Value)
				checkErr(r.Err)
			case <-pool.Done:
				break Loop
			}
			count++
		}
	},
}
