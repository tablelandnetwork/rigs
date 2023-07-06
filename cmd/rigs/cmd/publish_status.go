package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

func init() {
	publishCmd.AddCommand(statusCmd)
}

var statusCmd = &cobra.Command{
	Use:   "status <cid>",
	Short: "Get storage status for a cid",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := pub.GetStatus(cmd.Context(), args[0])
		checkErr(err)
		b, err := json.MarshalIndent(res, "", "  ")
		checkErr(err)
		fmt.Println(string(b))
	},
}
