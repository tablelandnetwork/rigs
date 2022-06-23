package cmd

import (
	"net/http"
	"time"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	storage "github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/impl/sqlite"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/impl/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/util"
)

var (
	remoteIpfs *httpapi.HttpApi
	store      storage.Store
)

func init() {
	rootCmd.AddCommand(publishCmd)

	publishCmd.PersistentFlags().String("remote-ipfs-api-url", "", "ipfs api url used for remotely pinning data")
	publishCmd.PersistentFlags().String("remote-ipfs-api-user", "", "auth user for remote ipfs api")
	publishCmd.PersistentFlags().String("remote-ipfs-api-pass", "", "auth pass for remote ipfs api")
	publishCmd.PersistentFlags().Bool(
		"to-tableland",
		false,
		"whether or not to publish to tableland, if not, publish to local store",
	)
	publishCmd.PersistentFlags().String("parts-table", "", "name of the tableland parts table")
	publishCmd.PersistentFlags().String("layers-table", "", "name of the tableland layers table")
	publishCmd.PersistentFlags().String("rigs-table", "", "name of the tableland rigs table")
	publishCmd.PersistentFlags().String("rig-attrs-table", "", "name of the tableland rig attributes table")
	publishCmd.Flags().String("tbl-db-path", "", "path to the local tableland sqlite db file")
}

var publishCmd = &cobra.Command{
	Use:   "publish",
	Short: "Push rigs data to tableland and remote IPFS",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		rootCmd.PersistentPreRun(cmd, args)
		checkErr(viper.BindPFlags(cmd.Flags()))

		var err error

		httpClient := &http.Client{}
		remoteIpfs, err = httpapi.NewURLApiWithClient(viper.GetString("remote-ipfs-api-url"), httpClient)
		checkErr(err)
		user := viper.GetString("remote-ipfs-api-user")
		pass := viper.GetString("remote-ipfs-api-pass")
		remoteIpfs.Headers.Add("Authorization", util.BasicAuthString(user, pass))

		if viper.GetBool("to-tableland") {
			store = tableland.NewStore(tableland.Config{
				TblClient:              tblClient,
				ReceiptTimeout:         time.Second * 10,
				PartsTableName:         viper.GetString("parts-table"),
				LayersTableName:        viper.GetString("layers-table"),
				RigsTableName:          viper.GetString("rigs-table"),
				RigAttributesTableName: viper.GetString("rig-attrs-table"),
			})
		} else {
			var err error
			store, err = sqlite.NewStore(viper.GetString("tbl-db-path"), cmd.Use == "schema")
			checkErr(err)
		}
	},
}
