package cmd

import (
	"database/sql"
	"encoding/base64"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	storage "github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/impl/sqlite"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/impl/tableland"
	"github.com/textileio/go-tableland/pkg/client"
	"github.com/textileio/go-tableland/pkg/wallet"
)

var (
	_db        *sql.DB
	_ethClient *ethclient.Client

	remoteIpfs *httpapi.HttpApi
	store      storage.Store
	tblClient  *client.Client
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
	publishCmd.PersistentFlags().Duration(
		"receipt-timeout",
		time.Minute*5,
		"how long to wait for a txn receipt before failing",
	)
	publishCmd.PersistentFlags().String("parts-table", "", "name of the tableland parts table")
	publishCmd.PersistentFlags().String("layers-table", "", "name of the tableland layers table")
	publishCmd.PersistentFlags().String("rigs-table", "", "name of the tableland rigs table")
	publishCmd.PersistentFlags().String("rig-attrs-table", "", "name of the tableland rig attributes table")
	publishCmd.Flags().String("tbl-db-path", "", "path to the local tableland sqlite db file")

	publishCmd.PersistentFlags().String("tbl-api-url", "http://localhost:8080", "tableland validator api url")
	publishCmd.PersistentFlags().String("eth-api-url", "http://localhost:8545", "ethereum api url")
	publishCmd.PersistentFlags().Int64("chain-id", 31337, "the chain id")
	publishCmd.PersistentFlags().String("contract-addr", "", "the tableland contract address")
	publishCmd.PersistentFlags().String("private-key", "", "the private key of for the client to use")
}

var publishCmd = &cobra.Command{
	Use:   "publish",
	Short: "Push rigs data to tableland and remote IPFS",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		rootCmd.PersistentPreRun(cmd, args)

		var err error

		httpClient := &http.Client{}
		remoteIpfs, err = httpapi.NewURLApiWithClient(viper.GetString("remote-ipfs-api-url"), httpClient)
		checkErr(err)
		user := viper.GetString("remote-ipfs-api-user")
		pass := viper.GetString("remote-ipfs-api-pass")
		remoteIpfs.Headers.Add("Authorization", basicAuthString(user, pass))

		_ethClient, err = ethclient.Dial(viper.GetString("eth-api-url"))
		checkErr(err)

		wallet, err := wallet.NewWallet(viper.GetString("private-key"))
		checkErr(err)

		config := client.Config{
			TblAPIURL:    viper.GetString("tbl-api-url"),
			EthBackend:   _ethClient,
			ChainID:      client.ChainID(viper.GetInt64("chain-id")),
			ContractAddr: common.HexToAddress(viper.GetString("contract-addr")),
			Wallet:       wallet,
		}
		tblClient, err = client.NewClient(ctx, config)
		checkErr(err)

		if viper.GetBool("to-tableland") {
			store = tableland.NewStore(tableland.Config{
				TblClient:              tblClient,
				ReceiptTimeout:         viper.GetDuration("receipt-timeout"),
				PartsTableName:         viper.GetString("parts-table"),
				LayersTableName:        viper.GetString("layers-table"),
				RigsTableName:          viper.GetString("rigs-table"),
				RigAttributesTableName: viper.GetString("rig-attrs-table"),
			})
		} else {
			_db, err = sql.Open("sqlite3", viper.GetString("tbl-db-path"))
			checkErr(err)
			store, err = sqlite.NewStore(_db)
			checkErr(err)
		}
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		rootCmd.PersistentPostRun(cmd, args)
		_ethClient.Close()
		tblClient.Close()
		if _db != nil {
			_ = _db.Close()
		}
	},
}

func basicAuthString(user, pass string) string {
	auth := user + ":" + pass
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(auth))
}
