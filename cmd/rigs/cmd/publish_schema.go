package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	storage "github.com/tablelandnetwork/rigs/pkg/storage/tableland"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

func init() {
	publishCmd.AddCommand(schemaCmd)

	schemaCmd.Flags().Int("concurrency", 1, "number of concurrent workers used to push table schemas to tableland")
	schemaCmd.Flags().Bool("parts", false, "publish the schema for the parts table")
	schemaCmd.Flags().Bool("layers", false, "publish the schema for the layers table")
	schemaCmd.Flags().Bool("rigs", false, "publish the schema for the rigs table")
	schemaCmd.Flags().Bool("attrs", false, "publish the schema for the rig attributes table")
	schemaCmd.Flags().Bool("deals", false, "publish the schema for the deals table")
	schemaCmd.Flags().Bool("lookups", false, "publish the schema for the lookups table")
	schemaCmd.Flags().Bool("ft_rewards", false, "publish the schema for the ft rewards table")
}

var schemaCmd = &cobra.Command{
	Use:   "schema",
	Short: "Create the rigs tables",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		publishAll := !viper.GetBool("parts") &&
			!viper.GetBool("layers") &&
			!viper.GetBool("rigs") &&
			!viper.GetBool("attrs") &&
			!viper.GetBool("deals") &&
			!viper.GetBool("lookups") &&
			!viper.GetBool("ft_rewards")

		createTableExecFcn := func(definition storage.TableDefinition) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				tblName, err := store.CreateTable(ctx, definition)
				if err != nil {
					return nil, fmt.Errorf("creating table: %v", err)
				}
				return tblName, nil
			}
		}

		var jobs []wpool.Job
		var jobID int

		if viper.GetBool("parts") || publishAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: createTableExecFcn(storage.PartsDefinition)})
		}
		if viper.GetBool("layers") || publishAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: createTableExecFcn(storage.LayersDefinition)})
		}
		if viper.GetBool("rigs") || publishAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: createTableExecFcn(storage.RigsDefinition)})
		}
		if viper.GetBool("attrs") || publishAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: createTableExecFcn(storage.RigAttributesDefinition)})
		}
		if viper.GetBool("deals") || publishAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: createTableExecFcn(storage.DealsDefinition)})
		}
		if viper.GetBool("lookups") || publishAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: createTableExecFcn(storage.LookupsDefinition)})
		}
		if viper.GetBool("ft_rewards") || publishAll {
			jobID++
			jobs = append(jobs, wpool.Job{ID: wpool.JobID(jobID), ExecFn: createTableExecFcn(storage.FtRewardsDefinition)})
		}

		pool := wpool.New(viper.GetInt("concurrency"), rate.Every(time.Millisecond*100))
		go pool.GenerateFrom(jobs)
		go pool.Run(ctx)
		for r := range pool.Results() {
			if r.Err != nil {
				fmt.Printf("error processing job %d: %v\n", r.ID, r.Err)
				continue
			}
			result := r.Value.(string)
			fmt.Printf("created table %s\n", result)
		}
	},
}
