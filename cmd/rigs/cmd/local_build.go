package cmd

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/wpool"
	"golang.org/x/time/rate"
)

func init() {
	localCmd.AddCommand(buildCmd)

	buildCmd.Flags().Bool("no-originals", false, "don't include the originals")
	buildCmd.Flags().Int("concurrency", 1, "how many concurrent workers used for generating rigs")
}

var buildCmd = &cobra.Command{
	Use:   "build count",
	Short: "Builds rig data and imagery",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		count, err := strconv.Atoi(args[0])
		checkErr(err)

		checkErr(localStore.ClearRigs(ctx))

		b := builder.NewBuilder(localStore, ipfsClient)

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

		buildExecFcn := func(opt builder.BuildOption) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				rig, err := b.Build(ctx, opt)
				return rig, err
			}
		}

		var jobs []wpool.Job

		for i, originalRig := range jobMeta {
			rigID := i + 1
			var opt builder.BuildOption
			var desc string
			if originalRig != nil {
				opt = builder.BuildOriginal(rigID, *originalRig, system.NewSystemRandomnessSource())
				desc = "original"
			} else {
				opt = builder.BuildRandom(rigID, system.NewSystemRandomnessSource())
				desc = "random"
			}
			jobs = append(jobs, wpool.Job{
				ID:     wpool.JobID(rigID),
				ExecFn: buildExecFcn(opt),
				Desc:   desc,
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
				fmt.Printf("built %s rig %d\n", r.Desc, rig.ID)
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
