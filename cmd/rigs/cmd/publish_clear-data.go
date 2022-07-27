package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

func init() {
	publishCmd.AddCommand(clearDataCmd)
}

var clearDataCmd = &cobra.Command{
	Use:   "clear-data",
	Short: "Delete all data from rigs tables",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		clearDataExecFn := func(clearDataFn func(context.Context) error) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				if err := clearDataFn(ctx); err != nil {
					return nil, fmt.Errorf("clearing data from table: %v", err)
				}
				return nil, nil
			}
		}

		jobs := []wpool.Job{
			{ID: 1, ExecFn: clearDataExecFn(store.ClearPartsData), Desc: "parts"},
			{ID: 2, ExecFn: clearDataExecFn(store.ClearLayersData), Desc: "layers"},
			{ID: 3, ExecFn: clearDataExecFn(store.ClearRigsData), Desc: "rigs"},
			{ID: 4, ExecFn: clearDataExecFn(store.ClearRigAttributesData), Desc: "rig attributes"},
		}

		pool := wpool.New(4, rate.Every(time.Millisecond*100))
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
					fmt.Printf("error processing job %d, %s: %v\n", r.ID, r.Desc, r.Err)
					continue
				}
				fmt.Printf("cleared table %s\n", r.Desc)
			case <-pool.Done:
				fmt.Println("Ok done")
				break Loop
			}
		}
	},
}
