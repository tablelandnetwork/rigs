package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

func init() {
	publishCmd.AddCommand(listTablesCmd)
}

var listTablesCmd = &cobra.Command{
	Use:   "list-tables",
	Short: "List existing tableland tables",
	Run: func(cmd *cobra.Command, args []string) {
		res, err := tblClient.List(cmd.Context())
		checkErr(err)
		json, err := json.MarshalIndent(res, "", "  ")
		checkErr(err)
		fmt.Println(string(json))
	},
}
