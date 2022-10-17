package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	rendersCmd.Flags().String("renders-path", "./renders", "path to the rendered images")

	publishCmd.AddCommand(rendersCmd)
}

var rendersCmd = &cobra.Command{
	Use:   "renders",
	Short: "Publish rig renders to nft.storage",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()
		path := viper.GetString("renders-path")
		cid, err := dirPublisher.PublishDir(ctx, path, "renders")
		checkErr(err)
		checkErr(localStore.TrackCid(ctx, "renders", cid))
		fmt.Printf("Renders published with cid %s\n", cid)
	},
}
