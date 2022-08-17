package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	imagesCmd.Flags().String("images-path", "./renders", "path to the rendered images")

	publishCmd.AddCommand(imagesCmd)
}

var imagesCmd = &cobra.Command{
	Use:   "images",
	Short: "Publish rig images to nft.storage",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()
		path := viper.GetString("images-path")
		cid, err := dirPublisher.PublishDir(ctx, path)
		checkErr(err)
		checkErr(localStore.TrackCid(ctx, "images", cid))
		fmt.Printf("Images published with cid %s\n", cid)
	},
}
