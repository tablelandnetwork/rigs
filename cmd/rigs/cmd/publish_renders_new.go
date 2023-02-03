package cmd

import (
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/time/rate"
)

func init() {
	rendersNewCmd.Flags().String("renders-path", "./renders", "path to the rendered images")
	rendersNewCmd.Flags().Int("concurrency", 10, "number of concurrent uploads to web3.storage")
	rendersNewCmd.Flags().Duration("rate-limit", time.Millisecond*350, "rate limit for uploads to web3.storage")

	publishCmd.AddCommand(rendersNewCmd)
}

var rendersNewCmd = &cobra.Command{
	Use:   "renders-new",
	Short: "Publish rig renders to web3.storage",
	Run: func(cmd *cobra.Command, args []string) {
		checkErr(dirPublisher.RendersToWeb3Storage(
			cmd.Context(),
			viper.GetString("renders-path"),
			viper.GetInt("concurrency"),
			rate.Every(viper.GetDuration("rate-limit")),
		))
	},
}
