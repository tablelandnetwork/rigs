package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

func init() {
	publishCmd.AddCommand(dataCmd)

	dataCmd.Flags().String("local-db-path", "", "path the the sqlite db file")
}

var dataCmd = &cobra.Command{
	Use:   "data",
	Short: "push all data to tableland",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()

		s, err := local.NewStore(viper.GetString("local-db-path"), false)
		if err != nil {
			return fmt.Errorf("error creating local store: %v", err)
		}
		defer func() {
			if err := s.Close(); err != nil {
				fmt.Println("closing store")
			}
		}()

		jobID := 1

		// Parts
		var partsJobs []wpool.Job
		var partsPageSize uint = 500
		var partsOffset uint
		var hasResults = true
		partsExecFn := func(parts []local.Part, desc string) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				if err := store.InsertParts(ctx, parts); err != nil {
					return nil, fmt.Errorf("calling insert parts for %s: %v", desc, err)
				}
				fmt.Printf("inserted parts batch %s\n", desc)
				return nil, nil
			}
		}
		for hasResults {
			parts, err := s.Parts(ctx, local.PartsWithLimit(partsPageSize), local.PartsWithOffset(partsOffset))
			if err != nil {
				return fmt.Errorf("getting parts: %v", err)
			}
			if len(parts) == 0 {
				hasResults = false
				continue
			}
			partsJobs = append(
				partsJobs,
				wpool.Job{ID: wpool.JobID(jobID), ExecFn: partsExecFn(parts, fmt.Sprintf("offset %d", partsOffset))},
			)
			jobID++
			partsOffset += partsPageSize
		}

		_ = partsJobs

		// Layers
		var layersJobs []wpool.Job
		var layersPageSize uint = 360
		var layersOffset uint
		var layersHasResults = true
		layersExecFn := func(layers []local.Layer, desc string) wpool.ExecutionFn {
			return func(ctx context.Context) (interface{}, error) {
				if err := store.InsertLayers(ctx, layers); err != nil {
					return nil, fmt.Errorf("calling insert layers for %s: %v", desc, err)
				}
				fmt.Printf("inserted layers batch %s\n", desc)
				return nil, nil
			}
		}
		for layersHasResults {
			layers, err := s.Layers(ctx, local.LayersWithLimit(layersPageSize), local.LayersWithOffset(layersOffset))
			if err != nil {
				return fmt.Errorf("getting layers: %v", err)
			}
			if len(layers) == 0 {
				layersHasResults = false
				continue
			}
			layersJobs = append(
				layersJobs,
				wpool.Job{ID: wpool.JobID(jobID), ExecFn: layersExecFn(layers, fmt.Sprintf("offset %d", layersOffset))},
			)
			jobID++
			layersOffset += layersPageSize
		}

		pool := wpool.New(10)
		go pool.GenerateFrom(layersJobs)
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
			case <-pool.Done:
				fmt.Println("done")
				return nil
			}
		}
	},
}
