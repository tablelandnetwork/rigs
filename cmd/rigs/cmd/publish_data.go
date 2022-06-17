package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

const (
	partsPageSize  uint = 500
	layersPageSize uint = 360
	rigsPageSize   uint = 100
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

		partsJobs, err := partsJobs(ctx, s, &jobID)
		if err != nil {
			return fmt.Errorf("generating parts jobs")
		}

		layersJobs, err := layersJobs(ctx, s, &jobID)
		if err != nil {
			return fmt.Errorf("generating layers jobs")
		}

		rigsJobs, err := rigsJobs(ctx, s, &jobID)
		if err != nil {
			return fmt.Errorf("generating rigs jobs")
		}

		_ = partsJobs
		_ = layersJobs
		_ = rigsJobs

		var jobs []wpool.Job
		jobs = append(jobs, partsJobs...)
		jobs = append(jobs, layersJobs...)
		jobs = append(jobs, rigsJobs...)

		pool := wpool.New(10)
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
			case <-pool.Done:
				fmt.Println("done")
				return nil
			}
		}
	},
}

func partsJobs(ctx context.Context, s *local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	var hasResults = true
	execFn := func(parts []local.Part, desc string) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertParts(ctx, parts); err != nil {
				return nil, fmt.Errorf("calling insert parts for %s: %v", desc, err)
			}
			fmt.Printf("inserted parts batch %s\n", desc)
			return nil, nil
		}
	}
	for hasResults {
		parts, err := s.Parts(ctx, local.PartsWithLimit(partsPageSize), local.PartsWithOffset(offset))
		if err != nil {
			return nil, fmt.Errorf("getting parts: %v", err)
		}
		if len(parts) == 0 {
			hasResults = false
			continue
		}
		jobs = append(
			jobs,
			wpool.Job{ID: wpool.JobID(*jobID), ExecFn: execFn(parts, fmt.Sprintf("offset %d", offset))},
		)
		*jobID++
		offset += partsPageSize
	}
	return jobs, nil
}

func layersJobs(ctx context.Context, s *local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	var hasResults = true
	execFn := func(layers []local.Layer, desc string) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertLayers(ctx, layers); err != nil {
				return nil, fmt.Errorf("calling insert layers for %s: %v", desc, err)
			}
			fmt.Printf("inserted layers batch %s\n", desc)
			return nil, nil
		}
	}
	for hasResults {
		layers, err := s.Layers(ctx, local.LayersWithLimit(layersPageSize), local.LayersWithOffset(offset))
		if err != nil {
			return nil, fmt.Errorf("getting layers: %v", err)
		}
		if len(layers) == 0 {
			hasResults = false
			continue
		}
		jobs = append(
			jobs,
			wpool.Job{ID: wpool.JobID(*jobID), ExecFn: execFn(layers, fmt.Sprintf("offset %d", offset))},
		)
		*jobID++
		offset += layersPageSize
	}
	return jobs, nil
}

func rigsJobs(ctx context.Context, s *local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	var hasResults = true
	rigsExecFn := func(rigs []local.Rig, desc string) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertRigs(ctx, rigs); err != nil {
				return nil, fmt.Errorf("calling insert rigs for %s: %v", desc, err)
			}
			fmt.Printf("inserted rigs batch %s\n", desc)
			return nil, nil
		}
	}
	rigAttrsExecFn := func(rigs []local.Rig, desc string) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertRigAttributes(ctx, rigs); err != nil {
				return nil, fmt.Errorf("calling insert rig attrs for %s: %v", desc, err)
			}
			fmt.Printf("inserted rig attrs batch %s\n", desc)
			return nil, nil
		}
	}
	for hasResults {
		rigs, err := s.Rigs(ctx, local.RigsWithLimit(rigsPageSize), local.RigsWithOffset(offset))
		if err != nil {
			return nil, fmt.Errorf("getting rigs: %v", err)
		}
		if len(rigs) == 0 {
			hasResults = false
			continue
		}

		jobs = append(
			jobs,
			wpool.Job{ID: wpool.JobID(*jobID), ExecFn: rigsExecFn(rigs, fmt.Sprintf("offset %d", offset))},
			wpool.Job{ID: wpool.JobID(*jobID + 1), ExecFn: rigAttrsExecFn(rigs, fmt.Sprintf("offset %d", offset))},
		)
		*jobID += 2
		offset += rigsPageSize
	}
	return jobs, nil
}
