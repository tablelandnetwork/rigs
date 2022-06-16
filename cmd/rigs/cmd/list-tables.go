package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(listTablesCmd)
}

var listTablesCmd = &cobra.Command{
	Use:   "list-tables",
	Short: "list existing tableland tables",
	RunE: func(cmd *cobra.Command, args []string) error {
		res, err := tblClient.List(cmd.Context())
		if err != nil {
			return fmt.Errorf("error calling list: %v", err)
		}
		json, err := json.MarshalIndent(res, "", "  ")
		if err != nil {
			return fmt.Errorf("marshaling list result: %v", err)
		}
		fmt.Println(string(json))
		return nil
	},
}
