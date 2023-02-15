package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland"
	"github.com/tablelandnetwork/rigs/pkg/wpool"
	"golang.org/x/time/rate"
)

const (
	partsPageSize         uint = 500
	layersPageSize        uint = 130
	rigsPageSize          uint = 100
	rigAttributesPageSize uint = 70
	dealsPageSize              = 100
)

func init() {
	publishCmd.AddCommand(dataCmd)

	dataCmd.Flags().Int("concurrency", 1, "number of concurrent workers used to push data to tableland")
	dataCmd.Flags().Bool("parts", false, "publish data for the parts table")
	dataCmd.Flags().Bool("layers", false, "publish data for the layers table")
	dataCmd.Flags().Bool("rigs", false, "publish data for the rigs table")
	dataCmd.Flags().Bool("attrs", false, "publish data for the rig attributes table")
	dataCmd.Flags().Bool("deals", false, "publish data for the deals table")
	dataCmd.Flags().Bool("lookups", false, "publish data for lookups table")
	dataCmd.MarkFlagsMutuallyExclusive()
}

var dataCmd = &cobra.Command{
	Use:   "data",
	Short: "Push all data to tableland",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		publishAll := !viper.GetBool("parts") &&
			!viper.GetBool("layers") &&
			!viper.GetBool("rigs") &&
			!viper.GetBool("attrs") &&
			!viper.GetBool("deals") &&
			!viper.GetBool("lookups")

		var jobs []wpool.Job
		jobID := 1

		if viper.GetBool("parts") || publishAll {
			partsJobs, err := partsJobs(ctx, localStore, &jobID)
			checkErr(err)
			jobs = append(jobs, partsJobs...)
		}

		if viper.GetBool("layers") || publishAll {
			layersJobs, err := layersJobs(ctx, localStore, &jobID)
			checkErr(err)
			jobs = append(jobs, layersJobs...)
		}

		if viper.GetBool("rigs") || publishAll {
			rigsJobs, err := rigsJobs(ctx, localStore, &jobID)
			checkErr(err)
			jobs = append(jobs, rigsJobs...)
		}

		if viper.GetBool("attrs") || publishAll {
			attsJobs, err := attrsJobs(ctx, localStore, &jobID)
			checkErr(err)
			jobs = append(jobs, attsJobs...)
		}

		if viper.GetBool("deals") || publishAll {
			dealsJobs, err := dealsJobs(ctx, localStore, &jobID)
			checkErr(err)
			jobs = append(jobs, dealsJobs...)
		}

		if viper.GetBool("lookups") || publishAll {
			jobs = append(jobs, lookupsJob(localStore, &jobID))
		}

		pool := wpool.New(viper.GetInt("concurrency"), rate.Every(time.Millisecond*200))
		go pool.GenerateFrom(jobs)
		go pool.Run(ctx)
		for r := range pool.Results() {
			if r.Err != nil {
				fmt.Printf("error processing job %d: %v\n", r.ID, r.Err)
				continue
			}
			fmt.Printf("processed job %d. %s\n", r.ID, r.Desc)
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

func rigsJobs(ctx context.Context, s local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	rigsExecFn := func(rigs []local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertRigs(ctx, rigs); err != nil {
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
			wpool.Job{
				ID:     wpool.JobID(*jobID),
				ExecFn: rigsExecFn(rigs),
				Desc:   fmt.Sprintf("rigs offset %d", offset),
			},
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

func dealsJobs(ctx context.Context, s local.Store, jobID *int) ([]wpool.Job, error) {
	var jobs []wpool.Job
	var offset uint
	dealsExecFn := func(rigs []local.Rig) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := store.InsertDeals(ctx, rigs); err != nil {
				return nil, fmt.Errorf("calling insert deals: %v", err)
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
			wpool.Job{
				ID:     wpool.JobID(*jobID),
				ExecFn: dealsExecFn(rigs),
				Desc:   fmt.Sprintf("deals offset %d", offset),
			},
		)
		*jobID++
		offset += dealsPageSize
	}
	return jobs, nil
}

func lookupsJob(s local.Store, jobID *int) wpool.Job {
	return wpool.Job{
		ID: wpool.JobID(*jobID),
		ExecFn: func(ctx context.Context) (interface{}, error) {
			rendersCid, err := s.Cid(ctx, "renders")
			if err != nil {
				return nil, fmt.Errorf("querying renders cid: %v", err)
			}
			layersCid, err := s.Cid(ctx, "layers")
			if err != nil {
				return nil, fmt.Errorf("querying layers cid: %v", err)
			}
			lookups := tableland.Lookups{
				RendersCid:           rendersCid,
				LayersCid:            layersCid,
				ImageFullName:        "image_full.png",
				ImageFullAlphaName:   "image_full_alpha.png",
				ImageMediumName:      "image_medium.png",
				ImageMediumAlphaName: "image_medium_alpha.png",
				ImageThumbName:       "image_thumb.png",
				ImageThumbAlphaName:  "image_thumb_alpha.png",
				AnimationBaseURL:     "https://rigs.tableland.xyz/",
				FilecoinBaseURL:      "https://filecoin.io/",
			}
			if err := store.InsertLookups(ctx, lookups); err != nil {
				return nil, fmt.Errorf("calling insert lookups: %v", err)
			}
			return nil, nil
		},
		Desc: "lookups job",
	}
}
