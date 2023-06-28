package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

func init() {
	publishCmd.AddCommand(listCidsCmd)
}

var listCidsCmd = &cobra.Command{
	Use:   "list-cids",
	Short: "List tracked cids of folers published to car storage",
	Run: func(cmd *cobra.Command, args []string) {
		res, err := localStore.Cids(cmd.Context())
		checkErr(err)
		fmt.Println("Tracked cids:")
		tw := tabwriter.NewWriter(os.Stdout, 0, 8, 2, '\t', tabwriter.AlignRight)
		for _, c := range res {
			fmt.Fprintf(
				tw,
				"\t%s\t%s\t\n",
				c.Label, c.Cid,
			)
		}
		checkErr(tw.Flush())
	},
}
