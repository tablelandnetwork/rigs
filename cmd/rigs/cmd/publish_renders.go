package cmd

import (
	"fmt"
	"time"

	"github.com/ipfs/go-cid"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	rendersCmd.Flags().String("renders-path", "./renders", "path to the rendered images")
	rendersCmd.Flags().String("cid", "", "cid of the rendered images")
	rendersCmd.Flags().String("chunks-dir", "", "directory where car chunks are written")
	rendersCmd.Flags().Int("concurrency", 2, "number of concurrent uploads to nft.storage")
	rendersCmd.Flags().Duration("rate-limit", time.Millisecond*350, "rate limit for uploads to nft.storage")

	publishCmd.AddCommand(rendersCmd)
}

var rendersCmd = &cobra.Command{
	Use:   "renders",
	Short: "Publish rig renders to nft.storage",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		path := viper.GetString("renders-path")
		cidString := viper.GetString("cid")
		var c cid.Cid
		var err error
		if cidString != "" {
			c, err = cid.Decode(cidString)
			checkErr(err)
		}
		chunksDir := viper.GetString("chunks-dir")

		if chunksDir == "" && !c.Defined() {
			c, err = dirPublisher.DirToIpfs(ctx, path)
			checkErr(err)
			fmt.Printf("Images added to IPFS with cid %s\n", c.String())
			checkErr(localStore.TrackCid(ctx, "renders", c.String()))
		}
		if chunksDir == "" && c.Defined() {
			chunksDir, err = dirPublisher.CidToCarChunks(ctx, c)
			checkErr(err)
			fmt.Printf("Car chunks written to folder %s\n", chunksDir)
		}
		checkErr(dirPublisher.CarChunksToNftStorage(
			ctx,
			chunksDir,
			viper.GetInt("concurrency"),
			viper.GetDuration("rate-limit"),
		))
		fmt.Printf("Renders published with cid %s\n", c.String())
	},
}
