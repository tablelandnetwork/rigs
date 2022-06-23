package cmd

import (
	"context"
	"fmt"
	"image/png"
	"math/rand"
	"strconv"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"golang.org/x/time/rate"
)

func init() {
	localCmd.AddCommand(buildCmd)

	buildCmd.PersistentFlags().String("ipfs-gateway-url", "http://127.0.0.1:8080", "address of the local ipfs gateway")

	buildCmd.Flags().Bool("no-originals", false, "don't include the originals")
	buildCmd.Flags().Int("size", 1200, "width and height of generated images")
	buildCmd.Flags().Int("thumb-size", 600, "width and height of generated thumb images")
	buildCmd.Flags().Bool("labels", false, "render metadata labels on generated images")
	buildCmd.Flags().Int("concurrency", 2, "how many concurrent workers used for generating rigs")
}

var buildCmd = &cobra.Command{
	Use:   "build count",
	Short: "Builds rig data and imagery",
	Args:  cobra.ExactArgs(1),
	PreRun: func(cmd *cobra.Command, args []string) {
		checkErr(viper.BindPFlags(cmd.Flags()))
	},
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		count, err := strconv.Atoi(args[0])
		checkErr(err)

		checkErr(localStore.ClearRigs(ctx))

		b := builder.NewBuilder(localStore, ipfsClient, viper.GetString("ipfs-gateway-url"))

		jobMeta := make([]*local.OriginalRig, count)

		if !viper.GetBool("no-originals") {
			originals, err := localStore.GetOriginalRigs(ctx)
			checkErr(err)
			if len(originals) > count {
				checkErr(fmt.Errorf("build count isn't >= number of originals (%d)", len(originals)))
			}

			origIndexes := randoms(len(originals), 0, count-1)

			for i, original := range originals {
				tmp := original
				jobMeta[origIndexes[i]] = &tmp
			}
		}

		buildExecFcn := func(opts []builder.BuildOption) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				rig, err := b.Build(ctx, opts...)
				return rig, err
			}
		}

		var jobs []wpool.Job

		for i, originalRig := range jobMeta {
			opts := []builder.BuildOption{
				builder.BuildCompression(png.DefaultCompression),
				builder.BuildLabels(viper.GetBool("lablels")),
				builder.BuildSize(viper.GetInt("size")),
				builder.BuildThumbSize(viper.GetInt("thumb-size")),
			}
			if originalRig != nil {
				opts = append(opts, builder.BuildOriginal(i+1, *originalRig, system.NewSystemRandomnessSource()))
			} else {
				opts = append(opts, builder.BuildRandom(i+1, system.NewSystemRandomnessSource()))
			}
			jobs = append(jobs, wpool.Job{
				ID:     wpool.JobID(i + 1),
				ExecFn: buildExecFcn(opts),
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
				rig := r.Value.(*local.Rig)
				fmt.Printf("%d. %s%s\n", rig.ID, rig.Gateway, rig.Image)
			case <-pool.Done:
				break Loop
			}
		}
	},
}

func randoms(count, min, max int) []int {
	rand.Seed(time.Now().UnixNano())
	res := make([]int, count)
	used := make(map[int]struct{}, count)
	for i := 0; i < count; i++ {
		for {
			val := rand.Intn(max-min+1) + min
			if _, found := used[val]; !found {
				used[val] = struct{}{}
				res[i] = val
				break
			}
		}
	}
	return res
}
