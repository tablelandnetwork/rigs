package cmd

import (
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(tablesCmd)
}

var tablesCmd = &cobra.Command{
	Use:   "tables",
	Short: "interact with Tableland Rigs tables",
	RunE: func(cmd *cobra.Command, args []string) error {
		return nil
	},
}
