package cmd

import (
	"context"
	"fmt"
	"io/ioutil"
	"path"
	"strconv"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

func init() {
	rendersNewCmd.Flags().String("renders-path", "./renders", "path to the rendered images")
	rendersNewCmd.Flags().Int("concurrency", 10, "number of concurrent uploads to nft.storage")
	rendersNewCmd.Flags().Duration("rate-limit", time.Millisecond*350, "rate limit for uploads to web3.storage")

	publishCmd.AddCommand(rendersNewCmd)
}

var rendersNewCmd = &cobra.Command{
	Use:   "renders-new",
	Short: "Publish rig renders to web3.storage",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		rendersPath := viper.GetString("renders-path")

		execFcn := func(dir string, rigID int) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				c, err := dirPublisher.DirToIpfs(ctx, dir)
				if err != nil {
					return nil, fmt.Errorf("adding dir to ipfs: %v", err)
				}
				c2, err := dirPublisher.CidToWeb3Storage(ctx, c)
				if err != nil {
					return nil, fmt.Errorf("uploading car to web3.storage: %v", err)
				}
				if !c.Equals(c2) {
					return nil, fmt.Errorf("ipfs cid %s is not equal to web3.storage cid %s", c.String(), c2.String())
				}
				if err := localStore.UpdateRigRendersCid(ctx, rigID, c); err != nil {
					return nil, fmt.Errorf("updating rig id in store: %v", err)
				}
				return c, nil
			}
		}

		var jobs []wpool.Job

		folders, err := ioutil.ReadDir(rendersPath)
		checkErr(err)

		for i, folder := range folders {
			if !folder.IsDir() {
				continue
			}
			rigID, err := strconv.Atoi(folder.Name())
			checkErr(err)
			jobs = append(jobs, wpool.Job{
				ID:     wpool.JobID(i),
				ExecFn: execFcn(path.Join(rendersPath, folder.Name()), rigID),
			})
		}

		pool := wpool.New(viper.GetInt("concurrency"), rate.Every(viper.GetDuration("rate-limit")))
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

		rigs, err := localStore.Rigs(ctx)
		checkErr(err)
		c, err := dirPublisher.RigsIndexToWeb3Storage(ctx, rigs)
		checkErr(err)
		fmt.Printf("uploaded index with cid - %s", c.String())
	},
}
