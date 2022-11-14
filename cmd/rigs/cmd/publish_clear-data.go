package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

func init() {
	publishCmd.AddCommand(clearDataCmd)

	clearDataCmd.Flags().Bool("parts", false, "clear data for the parts table")
	clearDataCmd.Flags().Bool("layers", false, "clear data for the layers table")
	clearDataCmd.Flags().Bool("attrs", false, "clear data for the rig attributes table")
	clearDataCmd.Flags().Bool("lookups", false, "clear data for the lookups table")
}

var clearDataCmd = &cobra.Command{
	Use:   "clear-data",
	Short: "Delete all data from rigs tables",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		clearAll := !viper.GetBool("parts") &&
			!viper.GetBool("layers") &&
			!viper.GetBool("attrs") &&
			!viper.GetBool("lookups")

		clearDataExecFn := func(clearDataFn func(context.Context) error) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				if err := clearDataFn(ctx); err != nil {
					return nil, fmt.Errorf("clearing data from table: %v", err)
				}
				return nil, nil
			}
		}

		var jobs []wpool.Job
		var jobID int

		if viper.GetBool("parts") || clearAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearParts), Desc: "parts"})
		}
		if viper.GetBool("layers") || clearAll {
			jobID++
			jobs = append(
				jobs,
				wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearLayers), Desc: "layers"},
			)
		}
		if viper.GetBool("attrs") || clearAll {
			jobID++
			jobs = append(
				jobs,
				wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearRigAttributes), Desc: "rig attributes"},
			)
		}
		if viper.GetBool("lookups") || clearAll {
			jobID++
			jobs = append(
				jobs,
				wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearLookups), Desc: "lookups"},
			)
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
