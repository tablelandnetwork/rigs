package cmd

import (
	"fmt"
	"os"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/spf13/cobra"
)

func init() {
	publishCmd.AddCommand(imagesCmd)
}

var imagesCmd = &cobra.Command{
	Use:   "images <images-path>",
	Short: "Add and pin all rig images to remote ipfs node",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		fi, err := os.Stat(args[0])
		checkErr(err)

		node, err := ipfsfiles.NewSerialFile(args[0], false, fi)
		checkErr(err)

		fmt.Println("Adding images to remote IPFS...")

		res, err := remoteIpfs.Unixfs().Add(ctx, node, options.Unixfs.Pin(true), options.Unixfs.CidVersion(1))
		checkErr(err)

		fmt.Printf("Images added to remote IPFS with path %s\n", res.String())
	},
}
