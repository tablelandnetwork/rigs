package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/textileio/go-tableland/pkg/client"
)

type tableDefinition struct {
	prefix string
	schema string
}

var (
	partsDefinition = tableDefinition{
		prefix: "parts",
		schema: `(
			fleet text,
			original text,
			type text not null,
			name text not null,
			color text,
			primary key(fleet,name,color)
		)`,
	}
	rigsDefinition = tableDefinition{
		prefix: "rigs",
		schema: `(
			id integer primary key,
			image text
		)`,
	}
	rigAttributesDefinition = tableDefinition{
		prefix: "rig_attributes",
		schema: `(
			rig_id integer,
			display_type text,
			trait_type text,
			value integer,
			primary key(rig_id, trait_type)
		)`,
	}
	layersDefinition = tableDefinition{
		prefix: "layers",
		schema: `(
			fleet text not null,
			rig_attribute_value text not null,
			position integer not null,
			path text not null,
			primary key(fleet,rig_attribute_value,position)
		)`,
	}
)

func init() {
	tablesCmd.AddCommand(createCmd)
}

var createCmd = &cobra.Command{
	Use:   "create",
	Short: "create the rigs tables",
	RunE: func(cmd *cobra.Command, args []string) error {
		return createTables(cmd.Context())
	},
}

func createTables(ctx context.Context) error {
	type createTableResult struct {
		id   client.TableID
		name string
	}

	createTableExecFcn := func(definition tableDefinition) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			id, name, err := tblClient.Create(
				ctx,
				definition.schema,
				client.WithPrefix(definition.prefix),
				client.WithReceiptTimeout(time.Second*10),
			)
			if err != nil {
				return nil, fmt.Errorf("calling create: %v", err)
			}
			return createTableResult{id: id, name: name}, nil
		}
	}
	jobs := []wpool.Job{
		{
			ID:     1,
			ExecFn: createTableExecFcn(partsDefinition),
		},
		{
			ID:     2,
			ExecFn: createTableExecFcn(rigsDefinition),
		},
		{
			ID:     3,
			ExecFn: createTableExecFcn(rigAttributesDefinition),
		},
		{
			ID:     4,
			ExecFn: createTableExecFcn(layersDefinition),
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
			result := r.Value.(createTableResult)
			fmt.Printf("created table with id %s and name %s\n", result.id.String(), result.name)
		case <-pool.Done:
			return nil
		}
	}
}
