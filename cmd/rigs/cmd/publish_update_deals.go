package cmd

import (
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/time/rate"
)

func init() {
	updateDealsCmd.Flags().Int("concurrency", 10, "number of concurrent uploads to web3.storage")
	updateDealsCmd.Flags().Duration("rate-limit", time.Millisecond*350, "rate limit for requests to web3.storage")

	publishCmd.AddCommand(updateDealsCmd)
}

var updateDealsCmd = &cobra.Command{
	Use:   "update-deals",
	Short: "Update deal information from web3.storage",
	Run: func(cmd *cobra.Command, args []string) {
		checkErr(pub.UpdateWeb3StorageDeals(
			cmd.Context(),
			viper.GetInt("concurrency"),
			rate.Every(viper.GetDuration("rate-limit")),
		))
	},
}
