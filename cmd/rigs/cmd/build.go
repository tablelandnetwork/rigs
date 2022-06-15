package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

func init() {
	rootCmd.AddCommand(buildCmd)

	buildCmd.PersistentFlags().String("db-path", "", "path the the sqlite db file")
	buildCmd.PersistentFlags().String("ipfs-gateway-url", "http://127.0.0.1:8080", "address of the local ipfs gateway")
	buildCmd.PersistentFlags().Bool("ipfs-pin", true, "whether or not to pin generated images to the local ipfs")

	buildCmd.Flags().Int("image-width", 1200, "width of generated images")
	buildCmd.Flags().Int("image-height", 1200, "height of generated images")
	buildCmd.Flags().Bool("image-labels", false, "render metadata labels on generated images")
}

var buildCmd = &cobra.Command{
	Use:   "build",
	Short: "builds rig data and imagery",
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if err := viper.BindPFlags(cmd.Flags()); err != nil {
			return fmt.Errorf("error binding flags: %v", err)
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return build(cmd.Context())
	},
}

func build(ctx context.Context) error {
	s, err := local.NewStore(viper.GetString("db-path"), false)
	if err != nil {
		return fmt.Errorf("error creating sqlite store: %v", err)
	}

	b := builder.NewBuilder(s, ipfsClient, viper.GetString("ipfs-gateway-url"))

	buildExecFcn := func(opt builder.Option) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			rig, err := b.Build(ctx, opt)
			return rig, err
		}
	}

	originals, err := s.GetOriginalRigs(ctx)
	if err != nil {
		return fmt.Errorf("error getting originals: %v", err)
	}

	var jobs []wpool.Job
	for i, original := range originals {
		jobs = append(jobs, wpool.Job{
			ID: wpool.JobID(i + 1),
			ExecFn: buildExecFcn(
				builder.Original(i+1, original, system.NewSystemRandomnessSource())),
		})
	}

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
			rig := r.Value.(*local.Rig)
			fmt.Printf("%d. %s\n", rig.ID, rig.Image)
		case <-pool.Done:
			return nil
		}
	}
}
