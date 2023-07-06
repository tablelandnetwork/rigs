package cmd

import (
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/time/rate"
)

func init() {
	rendersCmd.Flags().String("renders-path", "./renders", "path to the rendered images")
	rendersCmd.Flags().Int("concurrency", 5, "number of concurrent uploads to car storage service")
	rendersCmd.Flags().Duration("rate-limit", time.Millisecond*1000, "rate limit for uploads to car storage service")

	publishCmd.AddCommand(rendersCmd)
}

var rendersCmd = &cobra.Command{
	Use:   "renders",
	Short: "Publish rig renders to a car storage service",
	Run: func(cmd *cobra.Command, args []string) {
		checkErr(pub.RendersToCarStorage(
			cmd.Context(),
			viper.GetString("renders-path"),
			viper.GetInt("concurrency"),
			rate.Every(viper.GetDuration("rate-limit")),
		))
	},
}
