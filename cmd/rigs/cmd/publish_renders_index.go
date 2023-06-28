package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	rendersIndexCmd.Flags().String("out", "./index.car", "filename to write the index CAR to")

	publishCmd.AddCommand(rendersIndexCmd)
}

var rendersIndexCmd = &cobra.Command{
	Use:   "renders-index",
	Short: "Publish rig renders to a car storage service",
	Run: func(cmd *cobra.Command, args []string) {
		c, err := pub.RendersIndexToCar(cmd.Context(), viper.GetString("out"))
		checkErr(err)
		fmt.Printf("Wrote Rigs index with cid %s to CAR file %s\n", c.String(), viper.GetString("out"))
	},
}
