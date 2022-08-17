package cmd

import (
	"database/sql"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/dirpublisher"
	"github.com/tablelandnetwork/rigs/pkg/nftstorage"
	storage "github.com/tablelandnetwork/rigs/pkg/storage/tableland"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/impl/files"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/impl/sqlite"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/impl/tableland"
	"github.com/textileio/go-tableland/pkg/client"
	"github.com/textileio/go-tableland/pkg/wallet"
)

var (
	_db        *sql.DB
	_ethClient *ethclient.Client

	dirPublisher *dirpublisher.DirPublisher
	store        storage.Store
	tblClient    *client.Client
)

func init() {
	rootCmd.AddCommand(publishCmd)

	publishCmd.PersistentFlags().String("nft-storage-key", "", "api key for nft.storage")
	publishCmd.PersistentFlags().Bool(
		"to-tableland",
		false,
		"whether or not to publish to tableland, if not, publish to local store",
	)
	publishCmd.PersistentFlags().String(
		"to-files",
		"",
		"write sql statements to files at the specified path",
	)
	publishCmd.PersistentFlags().Duration(
		"receipt-timeout",
		time.Minute*5,
		"how long to wait for a txn receipt before failing",
	)
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

		nftStorage := nftstorage.NewClient(viper.GetString("nft-storage-key"))
		dirPublisher = dirpublisher.NewDirPublisher(ipfsClient, nftStorage)

		_ethClient, err = ethclient.Dial(viper.GetString("eth-api-url"))
		checkErr(err)

		wallet, err := wallet.NewWallet(viper.GetString("private-key"))
		checkErr(err)

		chainID := viper.GetInt64("chain-id")

		config := client.Config{
			TblAPIURL:    viper.GetString("tbl-api-url"),
			EthBackend:   _ethClient,
			ChainID:      client.ChainID(chainID),
			ContractAddr: common.HexToAddress(viper.GetString("contract-addr")),
			Wallet:       wallet,
		}
		tblClient, err = client.NewClient(ctx, config)
		checkErr(err)

		if viper.GetBool("to-tableland") {
			store = tableland.NewStore(tableland.Config{
				ChainID:        chainID,
				TblClient:      tblClient,
				LocalStore:     localStore,
				ReceiptTimeout: viper.GetDuration("receipt-timeout"),
			})
		} else if viper.GetString("to-files") != "" {
			store, err = files.NewStore(files.Config{
				ChainID:    chainID,
				LocalStore: localStore,
				OutPath:    viper.GetString("to-files"),
			})
			checkErr(err)
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
