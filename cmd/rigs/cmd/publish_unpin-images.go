package cmd

import (
	"context"
	"fmt"

	"github.com/ipfs/interface-go-ipfs-core/options"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"golang.org/x/time/rate"
)

func init() {
	publishCmd.AddCommand(unpinImagesCmd)

	unpinImagesCmd.Flags().Bool(
		"all",
		false,
		"unpin ALL cids pinned to the remote ipfs, not just those in the local rigs table",
	)
}

var unpinImagesCmd = &cobra.Command{
	Use:   "unpin-images",
	Short: "Unpin rig images from remote ipfs node",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		execFcn := func(path ipfspath.Path) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				if err := remoteIpfs.Pin().Rm(ctx, path, options.Pin.RmRecursive(true)); err != nil {
					return nil, fmt.Errorf("removing pin: %v", err)
				}
				return nil, nil
			}
		}

		var unpinJobs []wpool.Job

		if viper.GetBool("all") {
			pins, err := remoteIpfs.Pin().Ls(ctx, options.Pin.Ls.Recursive())
			checkErr(err)
			i := 1
			for pin := range pins {
				unpinJobs = append(
					unpinJobs,
					wpool.Job{
						ID:     wpool.JobID(i),
						ExecFn: execFcn(pin.Path()),
						Desc:   pin.Path().String(),
					},
				)
				i++
			}
		} else {
			rigs, err := localStore.Rigs(ctx)
			checkErr(err)

			for _, rig := range rigs {
				path := ipfspath.New(rig.Images.String)
				unpinJobs = append(
					unpinJobs,
					wpool.Job{
						ID:     wpool.JobID(rig.ID),
						ExecFn: execFcn(path),
						Desc:   fmt.Sprintf("%d, %s", rig.ID, rig.Images.String),
					},
				)
			}
		}

		pool := wpool.New(30, rate.Inf)
		go pool.GenerateFrom(unpinJobs)
		go pool.Run(ctx)
		count := 1
	Loop:
		for {
			select {
			case r, ok := <-pool.Results():
				if !ok {
					break
				}
				if r.Err != nil {
					fmt.Printf("%d/%d error processing job %d (%s): %v\n", count, len(unpinJobs), r.ID, r.Desc, r.Err)
					break
				}
				fmt.Printf("%d/%d processed job %d (%s)\n", count, len(unpinJobs), r.ID, r.Desc)
			case <-pool.Done:
				fmt.Println("done")
				break Loop
			}
			count++
		}
	},
}
