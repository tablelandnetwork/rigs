package cmd

import (
	"fmt"
	"os"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	rootCmd.AddCommand(loadLayersCmd)

	loadLayersCmd.Flags().String("layers-path", "", "local filesystem path to the layer images")
	loadLayersCmd.Flags().Bool("ipfs-pin", true, "whether or not to pin generated images to the local ipfs")
}

var loadLayersCmd = &cobra.Command{
	Use:   "load-layers",
	Short: "load rig image layers to ipfs",
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if err := viper.BindPFlags(cmd.Flags()); err != nil {
			return fmt.Errorf("error binding flags: %v", err)
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		path := viper.GetString("layers-path")
		fi, err := os.Stat(path)
		if err != nil {
			return fmt.Errorf("error statting path to layers: %v", err)
		}

		node, err := ipfsfiles.NewSerialFile(path, false, fi)
		if err != nil {
			return fmt.Errorf("error creating searial file from path to layers: %v", err)
		}

		fmt.Println("Adding layers to IPFS...")

		ipfsPath, err := ipfsClient.Unixfs().Add(cmd.Context(), node, options.Unixfs.Pin(viper.GetBool("ipfs-pin")))
		if err != nil {
			return fmt.Errorf("error adding node to ipfs: %v", err)
		}

		fmt.Printf("Layers loaded to IPFS with path %s\n", ipfsPath.String())
		return nil
	},
}
