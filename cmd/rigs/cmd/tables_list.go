package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

func init() {
	tablesCmd.AddCommand(listCmd)
}

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "list existing tables",
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
