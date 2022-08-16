package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	publishCmd.AddCommand(listTablesCmd)
}

var listTablesCmd = &cobra.Command{
	Use:   "list-tables",
	Short: "List most recently created tableland tables",
	Run: func(cmd *cobra.Command, args []string) {
		chainID := viper.GetInt64("chain-id")
		res, err := localStore.TableNames(cmd.Context(), chainID)
		checkErr(err)
		fmt.Printf("Tracked tables for chain id %d:\n", chainID)
		tw := tabwriter.NewWriter(os.Stdout, 0, 8, 2, '\t', tabwriter.AlignRight)
		for _, t := range res {
			fmt.Fprintf(
				tw,
				"\t%s\t%s\t\n",
				t.Label, t.Name,
			)
		}
		checkErr(tw.Flush())
	},
}
