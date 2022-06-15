package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/impl/client"
)

func init() {
	tablesCmd.AddCommand(createCmd)

	createCmd.Flags().String("tbl-db-path", "", "path to the tableland sqlite db file")
}

var createCmd = &cobra.Command{
	Use:   "create",
	Short: "create the rigs tables",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()

		store := client.NewStore(tblClient, time.Second*10)
		// store, err := sqlite.NewStore(viper.GetString("tbl-db-path"), true)
		// if err != nil {
		// 	return fmt.Errorf("creating tableland store: %v", err)
		// }

		createTableExecFcn := func(definition tableland.TableDefinition) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				tblName, err := store.CreateTable(ctx, definition)
				if err != nil {
					return nil, fmt.Errorf("creating table: %v", err)
				}
				return tblName, nil
			}
		}
		jobs := []wpool.Job{
			{
				ID:     1,
				ExecFn: createTableExecFcn(tableland.PartsDefinition),
			},
			{
				ID:     2,
				ExecFn: createTableExecFcn(tableland.RigsDefinition),
			},
			{
				ID:     3,
				ExecFn: createTableExecFcn(tableland.RigAttributesDefinition),
			},
			{
				ID:     4,
				ExecFn: createTableExecFcn(tableland.LayersDefinition),
			},
		}

		pool := wpool.New(4)
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
				result := r.Value.(string)
				fmt.Printf("created table %s\n", result)
			case <-pool.Done:
				return nil
			}
		}
	},
}
