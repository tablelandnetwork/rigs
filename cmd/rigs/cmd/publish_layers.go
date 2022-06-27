package cmd

import (
	"fmt"
	"strings"

	"github.com/ipfs/interface-go-ipfs-core/options"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	publishCmd.AddCommand(layersCmd)

	layersCmd.Flags().String("ipfs-layers-path", "", "ipfs path to the rigs layers images")
}

var layersCmd = &cobra.Command{
	Use:   "layers",
	Short: "Pin all rig layer images to remote ipfs node",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		path := ipfspath.New(viper.GetString("ipfs-layers-path"))

		if err := remoteIpfs.Pin().Add(ctx, path); err != nil {
			if strings.Contains(err.Error(), "context deadline exceeded") {
				fmt.Println("timed out asking remote node to pin, adding directly...")
				node, err := ipfsClient.Unixfs().Get(ctx, path)
				checkErr(err)
				_, err = remoteIpfs.Unixfs().Add(
					ctx,
					node,
					options.Unixfs.CidVersion(1),
					options.Unixfs.Pin(true),
				)
				checkErr(err)
			}
			checkErr(err)
		}
		fmt.Printf("Successfully published %s to remote ipfs node\n", path.String())
	},
}
