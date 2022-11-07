package cmd

import (
	"fmt"

	"github.com/ipfs/go-cid"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	publishCmd.AddCommand(layersCmd)

	layersCmd.Flags().String("layers-path", "./artifacts/layers", "local filesystem path to the layer images")
	layersCmd.Flags().String("cid", "", "cid of the layers images")
	layersCmd.Flags().String("chunks-dir", "", "directory where car chunks are written")
}

var layersCmd = &cobra.Command{
	Use:   "layers",
	Short: "Pin all rig layer images to remote ipfs node",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		path := viper.GetString("layers-path")
		cidString := viper.GetString("cid")
		var c cid.Cid
		var err error
		if cidString != "" {
			c, err = cid.Decode(cidString)
			checkErr(err)
		}
		chunksDir := viper.GetString("chunks-dir")

		if chunksDir == "" && c.String() == "" {
			c, err = dirPublisher.DirToIpfs(ctx, path, "layers")
			checkErr(err)
			fmt.Printf("Images added to IPFS with cid %s\n", c.String())
		}
		if chunksDir == "" && c.String() != "" {
			chunksDir, err = dirPublisher.CidToCarChunks(ctx, c)
			checkErr(err)
			fmt.Printf("Car chunks written to folder %s\n", chunksDir)
		}
		checkErr(dirPublisher.CarChunksToNftStorage(ctx, chunksDir))
		fmt.Printf("Layers published with cid %s\n", c.String())
	},
}
