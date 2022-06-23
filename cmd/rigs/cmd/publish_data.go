package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
	"golang.org/x/time/rate"
)

const (
	partsPageSize  uint = 500
	layersPageSize uint = 360
	rigsPageSize   uint = 70
)

func init() {
	publishCmd.AddCommand(dataCmd)

	dataCmd.Flags().String("local-db-path", "", "path the the sqlite db file")
	dataCmd.Flags().String("remote-ipfs-gateway-url", "", "url of the gateway to use for nft image metadata")
}

var dataCmd = &cobra.Command{
	Use:   "data",
	Short: "push all data to tableland",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		s, err := impl.NewStore(viper.GetString("local-db-path"), false)
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
			return fmt.Errorf("generating parts jobs: %v", err)
		}

		layersJobs, err := layersJobs(ctx, s, &jobID)
		if err != nil {
			return fmt.Errorf("generating layers jobs: %v", err)
		}

		rigsJobs, err := rigsJobs(ctx, s, &jobID, viper.GetString("remote-ipfs-gateway-url"))
		if err != nil {
			return fmt.Errorf("generating rigs jobs: %v", err)
		}

		var jobs []wpool.Job
		jobs = append(jobs, partsJobs...)
		jobs = append(jobs, layersJobs...)
		jobs = append(jobs, rigsJobs...)

		pool := wpool.New(1, rate.Every(time.Millisecond*200))
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
					fmt.Printf("error processing job %d: %v\n", r.ID, r.Err)
					continue
				}
				fmt.Printf("processed job %d. %s\n", r.ID, r.Desc)
			case <-pool.Done:
				fmt.Println("done")
				break Loop
			}
		}
		return nil
	},
}

func partsJobs(ctx context.Context, s local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	execFn := func(parts []local.Part) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertParts(ctx, parts); err != nil {
				return nil, fmt.Errorf("calling insert parts: %v", err)
			}
			return nil, nil
		}
	}
	for {
		parts, err := s.Parts(ctx, local.PartsWithLimit(partsPageSize), local.PartsWithOffset(offset))
		if err != nil {
			return nil, fmt.Errorf("getting parts: %v", err)
		}
		if len(parts) == 0 {
			break
		}
		jobs = append(
			jobs,
			wpool.Job{ID: wpool.JobID(*jobID), ExecFn: execFn(parts), Desc: fmt.Sprintf("parts with offset %d", offset)},
		)
		*jobID++
		offset += partsPageSize
	}
	return jobs, nil
}

func layersJobs(ctx context.Context, s local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	execFn := func(layers []local.Layer) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertLayers(ctx, layers); err != nil {
				return nil, fmt.Errorf("calling insert layers: %v", err)
			}
			return nil, nil
		}
	}
	for {
		layers, err := s.Layers(ctx, local.LayersWithLimit(layersPageSize), local.LayersWithOffset(offset))
		if err != nil {
			return nil, fmt.Errorf("getting layers: %v", err)
		}
		if len(layers) == 0 {
			break
		}
		jobs = append(
			jobs,
			wpool.Job{ID: wpool.JobID(*jobID), ExecFn: execFn(layers), Desc: fmt.Sprintf("layers with offset %d", offset)},
		)
		*jobID++
		offset += layersPageSize
	}
	return jobs, nil
}

func rigsJobs(ctx context.Context, s local.Store, jobID *int, gateway string) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	rigsExecFn := func(rigs []local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertRigs(ctx, gateway, rigs); err != nil {
				return nil, fmt.Errorf("calling insert rigs: %v", err)
			}
			return nil, nil
		}
	}
	rigAttrsExecFn := func(rigs []local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertRigAttributes(ctx, rigs); err != nil {
				return nil, fmt.Errorf("calling insert rig attrs: %v", err)
			}
			return nil, nil
		}
	}
	for {
		rigs, err := s.Rigs(ctx, local.RigsWithLimit(rigsPageSize), local.RigsWithOffset(offset))
		if err != nil {
			return nil, fmt.Errorf("getting rigs: %v", err)
		}
		if len(rigs) == 0 {
			break
		}

		jobs = append(
			jobs,
			wpool.Job{ID: wpool.JobID(*jobID), ExecFn: rigsExecFn(rigs), Desc: fmt.Sprintf("rigs with offset %d", offset)},
			wpool.Job{
				ID:     wpool.JobID(*jobID + 1),
				ExecFn: rigAttrsExecFn(rigs),
				Desc:   fmt.Sprintf("rig attrs offset %d", offset),
			},
		)
		*jobID += 2
		offset += rigsPageSize
	}
	return jobs, nil
}
