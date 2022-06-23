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
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
	"golang.org/x/time/rate"
)

func init() {
	rootCmd.AddCommand(buildCmd)

	buildCmd.PersistentFlags().String("local-db-path", "", "path the the sqlite db file")
	buildCmd.PersistentFlags().String("ipfs-gateway-url", "http://127.0.0.1:8080", "address of the local ipfs gateway")
	buildCmd.PersistentFlags().Bool("ipfs-pin", true, "whether or not to pin generated images to the local ipfs")

	buildCmd.Flags().Bool("no-originals", false, "don't include the originals")
	buildCmd.Flags().Int("size", 1200, "width and height of generated images")
	buildCmd.Flags().Int("thumb-size", 600, "width and height of generated thumb images")
	buildCmd.Flags().Bool("labels", false, "render metadata labels on generated images")
	buildCmd.Flags().Bool("ipfs-pin", true, "whether or not to pin the generated images to the local ipfs node")
	buildCmd.Flags().Int("concurrency", 2, "how many concurrent workers used for generating rigs")
}

var buildCmd = &cobra.Command{
	Use:   "build count",
	Short: "builds rig data and imagery",
	Args:  cobra.ExactArgs(1),
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if err := viper.BindPFlags(cmd.Flags()); err != nil {
			return fmt.Errorf("error binding flags: %v", err)
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()

		count, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("error parsing count arg: %v", err)
		}

		s, err := impl.NewStore(viper.GetString("local-db-path"), false)
		if err != nil {
			return fmt.Errorf("error creating sqlite store: %v", err)
		}

		b := builder.NewBuilder(s, ipfsClient, viper.GetString("ipfs-gateway-url"))

		jobMeta := make([]*local.OriginalRig, count)

		if !viper.GetBool("no-originals") {
			originals, err := s.GetOriginalRigs(ctx)
			if err != nil {
				return fmt.Errorf("error getting originals: %v", err)
			}
			if len(originals) > count {
				return fmt.Errorf("build count isn't >= number of originals (%d)", len(originals))
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
				builder.BuildPin(viper.GetBool("ipfs-pin")),
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
				return nil
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
