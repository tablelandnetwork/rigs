package cmd

import (
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/time/rate"
)

func init() {
	updateDealsCmd.Flags().Int("concurrency", 10, "number of concurrent requests to car storage service")
	updateDealsCmd.Flags().Duration("rate-limit", time.Millisecond*350, "rate limit for requests to car storage service")
	updateDealsCmd.Flags().StringSlice("ids", []string{}, "limit to rigs with these ids")

	publishCmd.AddCommand(updateDealsCmd)
}

var updateDealsCmd = &cobra.Command{
	Use:   "update-deals",
	Short: "Update deal information from car storage service",
	Run: func(cmd *cobra.Command, args []string) {
		checkErr(pub.UpdateCarStorageDeals(
			cmd.Context(),
			viper.GetInt("concurrency"),
			rate.Every(viper.GetDuration("rate-limit")),
			viper.GetStringSlice("ids")...,
		))
	},
}
