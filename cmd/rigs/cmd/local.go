package cmd

import (
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(localCmd)
}

var localCmd = &cobra.Command{
	Use:   "local",
	Short: "Commands for generating and interacting with rigs data locally",
}
