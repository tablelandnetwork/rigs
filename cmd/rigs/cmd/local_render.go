package cmd

import (
	"context"
	"fmt"
	"image/png"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"golang.org/x/time/rate"
)

func init() {
	localCmd.AddCommand(renderCmd)

	renderCmd.Flags().String("ipfs-gateway-url", "http://127.0.0.1:8080", "address of the local ipfs gateway")
	renderCmd.Flags().Int("size", 1200, "width and height of generated images")
	renderCmd.Flags().Int("thumb-size", 600, "width and height of generated thumb images")
	renderCmd.Flags().Bool("labels", false, "render metadata labels on generated images")
	renderCmd.Flags().Int("concurrency", 2, "how many concurrent workers used for rendering rig images")
}

var renderCmd = &cobra.Command{
	Use:   "render",
	Short: "Renders rig imagery",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		b := builder.NewBuilder(localStore, ipfsClient)

		gatewayURL := viper.GetString("ipfs-gateway-url")

		rigs, err := localStore.Rigs(ctx)
		checkErr(err)

		renderExecFcn := func(rig local.Rig, opts []builder.RenderOption) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				err := b.Render(ctx, &rig, opts...)
				return rig, err
			}
		}

		var jobs []wpool.Job

		for _, rig := range rigs {
			opts := []builder.RenderOption{
				builder.RenderCompression(png.DefaultCompression),
				builder.RenderLabels(viper.GetBool("lablels")),
				builder.RenderSize(viper.GetInt("size")),
				builder.RenderThumbSize(viper.GetInt("thumb-size")),
				builder.RenderGatewayURL(gatewayURL),
			}
			jobs = append(jobs, wpool.Job{
				ID:     wpool.JobID(rig.ID),
				ExecFn: renderExecFcn(rig, opts),
			})
		}

		pool := wpool.New(viper.GetInt("concurrency"), rate.Inf)
		go pool.GenerateFrom(jobs)
		go pool.Run(ctx)
	Loop:
		for {
			select {
			case r, ok := <-pool.Results():
				if !ok {
					continue
				}
				if r.Err != nil {
					fmt.Printf("error processing job %d: %v\n", r.ID, r.Err)
					continue
				}
				rig := r.Value.(local.Rig)
				fmt.Printf("%d. %s%s\n", rig.ID, rig.Gateway.String, rig.Image.String)
			case <-pool.Done:
				break Loop
			}
		}
	},
}
