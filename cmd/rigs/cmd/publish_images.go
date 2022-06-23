package cmd

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ipfs/interface-go-ipfs-core/options"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/spf13/cobra"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"golang.org/x/time/rate"
)

func init() {
	publishCmd.AddCommand(imagesCmd)
}

var imagesCmd = &cobra.Command{
	Use:   "images",
	Short: "Pin all rig images to remote ipfs node",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		rigs, err := localStore.Rigs(ctx)
		checkErr(err)
		var pinJobs []wpool.Job
		execFcn := func(path ipfspath.Path) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				if err := remoteIpfs.Pin().Add(ctx, path); err != nil {
					if strings.Contains(err.Error(), "context deadline exceeded") {
						node, err := ipfsClient.Unixfs().Get(ctx, path)
						if err != nil {
							return nil, fmt.Errorf("getting ipfs node to add to remote ipfs: %v", err)
						}
						_, err = remoteIpfs.Unixfs().Add(
							ctx,
							node, options.Unixfs.CidVersion(1),
							options.Unixfs.Pin(true),
						)
						if err != nil {
							return nil, fmt.Errorf("adding node to remote ipfs after failed pin: %v", err)
						}
						return nil, nil
					}
					return nil, fmt.Errorf("adding pin: %v", err)
				}
				return nil, nil
			}
		}
		for i, rig := range rigs {
			path := ipfspath.New(rig.Images)
			pinJobs = append(
				pinJobs,
				wpool.Job{ID: wpool.JobID(i), ExecFn: execFcn(path), Desc: fmt.Sprintf("%d, %s", rig.ID, rig.Images)},
			)
		}

		pool := wpool.New(10, rate.Every(time.Millisecond*200))
		go pool.GenerateFrom(pinJobs)
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
					fmt.Printf("%d/%d error processing job %d: %v\n", count, len(pinJobs), r.ID, r.Err)
					break
				}
				fmt.Printf("%d/%d pinned %s\n", count, len(pinJobs), r.Desc)
			case <-pool.Done:
				fmt.Println("done")
				break Loop
			}
			count++
		}
	},
}
