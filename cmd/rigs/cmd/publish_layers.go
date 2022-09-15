package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	publishCmd.AddCommand(layersCmd)

	layersCmd.Flags().String("layers-path", "./artifacts/layers", "local filesystem path to the layer images")
}

var layersCmd = &cobra.Command{
	Use:   "layers",
	Short: "Pin all rig layer images to remote ipfs node",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()
		p := viper.GetString("layers-path")
		cid, err := dirPublisher.PublishDir(ctx, p, "layers")
		checkErr(err)
		fmt.Printf("Layers published with cid %s\n", cid)
	},
}
