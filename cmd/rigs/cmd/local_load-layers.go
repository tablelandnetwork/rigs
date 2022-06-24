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
	localCmd.AddCommand(loadLayersCmd)

	loadLayersCmd.Flags().String("layers-path", "", "local filesystem path to the layer images")
}

var loadLayersCmd = &cobra.Command{
	Use:   "load-layers",
	Short: "Load rig image layers to ipfs",
	Run: func(cmd *cobra.Command, args []string) {
		path := viper.GetString("layers-path")
		fi, err := os.Stat(path)
		checkErr(err)

		node, err := ipfsfiles.NewSerialFile(path, false, fi)
		checkErr(err)

		fmt.Println("Adding layers to IPFS...")

		ipfsPath, err := ipfsClient.Unixfs().Add(cmd.Context(), node, options.Unixfs.Pin(true))
		checkErr(err)

		fmt.Printf("Layers loaded to IPFS with path %s\n", ipfsPath.String())
	},
}
