package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

func init() {
	rootCmd.AddCommand(originalCmd)
}

var originalCmd = &cobra.Command{
	Use: "original",
	RunE: func(cmd *cobra.Command, args []string) error {
		s, err := local.NewStore(viper.GetString("local-db-path"), false)
		if err != nil {
			return fmt.Errorf("error creating sqlite store: %v", err)
		}
		b := builder.NewBuilder(s, ipfsClient, viper.GetString("ipfs-gateway-url"))

		// originals, err := s.GetOriginalRigs(cmd.Context())
		// if err != nil {
		// 	return fmt.Errorf("error getting originals: %v", err)
		// }

		count := 1
		for {
			fmt.Println(count)
			rig, err := b.BuildData(cmd.Context(), builder.BuildRandomData(count, system.NewSystemRandomnessSource()))
			// rig, err := b.BuildData(cmd.Context(), builder.BuildOriginalData(count, originals[0], system.NewSystemRandomnessSource()))
			if err != nil {
				return err
			}
			if rig.Original {
				fmt.Println("Found original!")
				b, err := json.MarshalIndent(rig, "", "  ")
				if err != nil {
					return err
				}
				fmt.Println(string(b))
				break
			}
			count++
		}
		return nil
	},
}
