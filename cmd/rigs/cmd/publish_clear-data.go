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
	clearDataCmd.Flags().Bool("rigs", false, "clear data for the rigs table")
	clearDataCmd.Flags().Bool("attrs", false, "clear data for the rig attributes table")
}

var clearDataCmd = &cobra.Command{
	Use:   "clear-data",
	Short: "Delete all data from rigs tables",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		clearAll := !viper.GetBool("parts") && !viper.GetBool("layers") && !viper.GetBool("rigs") && !viper.GetBool("attrs")

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
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearPartsData), Desc: "parts"})
		}
		if viper.GetBool("layers") || clearAll {
			jobID++
			jobs = append(
				jobs,
				wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearLayersData), Desc: "layers"},
			)
		}
		if viper.GetBool("rigs") || clearAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearRigsData), Desc: "rigs"})
		}
		if viper.GetBool("attrs") || clearAll {
			jobID++
			jobs = append(
				jobs,
				wpool.Job{ID: wpool.JobID(jobID), ExecFn: clearDataExecFn(store.ClearRigAttributesData), Desc: "rig attributes"},
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
