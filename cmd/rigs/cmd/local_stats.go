package cmd

import (
	"fmt"
	"math"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
)

func init() {
	localCmd.AddCommand(statsCmd)

	statsCmd.Flags().Float32(
		"threshold",
		5,
		"smallest difference between expected and actual percentage that results in a flagged value in the output",
	)
}

var statsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Print some stats about the local rigs",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		counts, err := localStore.Counts(ctx)
		checkErr(err)

		fmt.Printf("\nOriginal Rigs: %d\n", counts.Originals)
		fmt.Printf("Random Rigs: %d\n\n", counts.Randoms)

		fmt.Println("IMPORTANT:")
		fmt.Println("\n- The following distributions data represents only random Rigs.")
		fmt.Println("- Expected values are in parentheses.")
		fmt.Println("- Any result with a exptected-actual delta > --threshold are flagged with ***.")

		fleetRankings, err := localStore.FleetRankings(ctx)
		checkErr(err)
		expectedFleetRankings := builder.ScaledRanks("Fleets")

		fmt.Println("\nFleet Distribution:")
		tw := tabwriter.NewWriter(os.Stdout, 0, 8, 2, '\t', tabwriter.AlignRight)
		for _, ranking := range fleetRankings {
			expected := expectedFleetRankings[ranking.Name] * 100
			fmt.Fprintf(
				tw,
				"\t%s\t%d\t%.1f%% (%.1f%%) %s\t\n",
				ranking.Name, ranking.Count, ranking.Percentage, expected, flag(expected, ranking.Percentage),
			)
		}
		checkErr(tw.Flush())

		rankings, err := localStore.BackgroundColorRankings(ctx)
		checkErr(err)
		expectedRankings := builder.ScaledRanks("Backgrounds")

		fmt.Println("\nBackground Color Distribution:")
		tw = tabwriter.NewWriter(os.Stdout, 0, 8, 2, '\t', tabwriter.AlignRight)
		for _, ranking := range rankings {
			expected := expectedRankings[ranking.Name] * 100
			fmt.Fprintf(
				tw,
				"\t%s\t%d\t%.1f%% (%.1f%%) %s\t\n",
				ranking.Name, ranking.Count, ranking.Percentage, expected, flag(expected, ranking.Percentage),
			)
		}
		checkErr(tw.Flush())

		for _, fleetRanking := range fleetRankings {
			rankings, err = localStore.OriginalRankings(ctx, fleetRanking.Name)
			checkErr(err)
			expectedRankings := builder.ScaledRanks(fleetRanking.Name)

			fmt.Printf("\n%s Originals Distribution:\n", fleetRanking.Name)
			tw = tabwriter.NewWriter(os.Stdout, 0, 8, 2, '\t', tabwriter.AlignRight)
			for _, ranking := range rankings {
				expected := expectedRankings[ranking.Name] * 100
				fmt.Fprintf(
					tw,
					"\t%s\t%d\t%.1f%% (%.1f%%) %s\t\n",
					ranking.Name, ranking.Count, ranking.Percentage, expected, flag(expected, ranking.Percentage),
				)
			}
			checkErr(tw.Flush())
		}
	},
}

func flag(exptected, actual float64) string {
	if math.Abs(exptected-actual) >= viper.GetFloat64("threshold") {
		return "***"
	}
	return ""
}
