package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

func init() {
	publishCmd.AddCommand(rendersIndexCmd)
}

var rendersIndexCmd = &cobra.Command{
	Use:   "renders-index",
	Short: "Publish rig renders to a car storage service",
	Run: func(cmd *cobra.Command, args []string) {
		c, err := pub.RendersIndexToCarStorage(cmd.Context())
		checkErr(err)
		fmt.Printf("Published Rigs index with cid: %s", c.String())
	},
}
