package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	storage "github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
)

func init() {
	publishCmd.AddCommand(schemaCmd)
}

var schemaCmd = &cobra.Command{
	Use:   "schema",
	Short: "create the rigs tables",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		createTableExecFcn := func(definition storage.TableDefinition) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				tblName, err := store.CreateTable(ctx, definition)
				if err != nil {
					return nil, fmt.Errorf("creating table: %v", err)
				}
				return tblName, nil
			}
		}
		jobs := []wpool.Job{
			{ID: 1, ExecFn: createTableExecFcn(storage.PartsDefinition)},
			{ID: 2, ExecFn: createTableExecFcn(storage.RigsDefinition)},
			{ID: 3, ExecFn: createTableExecFcn(storage.RigAttributesDefinition)},
			{ID: 4, ExecFn: createTableExecFcn(storage.LayersDefinition)},
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
