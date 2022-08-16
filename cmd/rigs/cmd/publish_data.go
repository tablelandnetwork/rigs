package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

const (
	partsPageSize         uint = 500
	layersPageSize        uint = 360
	rigsPageSize          uint = 70
	rigAttributesPageSize uint = 70
)

func init() {
	publishCmd.AddCommand(dataCmd)

	dataCmd.Flags().Int("concurrency", 1, "number of concurrent workers used to push data to tableland")
}

var dataCmd = &cobra.Command{
	Use:   "data",
	Short: "Push all data to tableland",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		jobID := 1

		partsJobs, err := partsJobs(ctx, localStore, &jobID)
		checkErr(err)

		layersCid, err := localStore.Cid(ctx, "layers")
		checkErr(err)

		layersJobs, err := layersJobs(ctx, localStore, &jobID, layersCid)
		checkErr(err)

		imagesCid, err := localStore.Cid(ctx, "images")
		checkErr(err)

		rigsJobs, err := rigsJobs(
			ctx,
			localStore,
			&jobID,
			imagesCid,
		)
		checkErr(err)

		attsJobs, err := attrsJobs(ctx, localStore, &jobID)
		checkErr(err)

		var jobs []wpool.Job
		jobs = append(jobs, partsJobs...)
		jobs = append(jobs, layersJobs...)
		jobs = append(jobs, rigsJobs...)
		jobs = append(jobs, attsJobs...)

		pool := wpool.New(viper.GetInt("concurrency"), rate.Every(time.Millisecond*200))
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

func layersJobs(ctx context.Context, s local.Store, jobID *int, cid string) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	execFn := func(layers []local.Layer) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertLayers(ctx, cid, layers); err != nil {
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

func rigsJobs(ctx context.Context, s local.Store, jobID *int, cid string) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	rigsExecFn := func(rigs []local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertRigs(ctx, cid, rigs); err != nil {
				return nil, fmt.Errorf("calling insert rigs: %v", err)
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
		)
		*jobID++
		offset += rigsPageSize
	}
	return jobs, nil
}

func attrsJobs(ctx context.Context, s local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	rigAttrsExecFn := func(rigs []local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertRigAttributes(ctx, rigs); err != nil {
				return nil, fmt.Errorf("calling insert rig attrs: %v", err)
			}
			return nil, nil
		}
	}
	for {
		rigs, err := s.Rigs(ctx, local.RigsWithLimit(rigAttributesPageSize), local.RigsWithOffset(offset))
		if err != nil {
			return nil, fmt.Errorf("getting rigs: %v", err)
		}
		if len(rigs) == 0 {
			break
		}

		jobs = append(
			jobs,
			wpool.Job{
				ID:     wpool.JobID(*jobID),
				ExecFn: rigAttrsExecFn(rigs),
				Desc:   fmt.Sprintf("rig attrs offset %d", offset),
			},
		)
		*jobID++
		offset += rigAttributesPageSize
	}
	return jobs, nil
}
