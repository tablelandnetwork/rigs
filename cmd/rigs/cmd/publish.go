package cmd

import (
	"database/sql"
	"fmt"
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
	publishCmd.PersistentFlags().String("tbl-db-path", "", "path to the local tableland sqlite db file")
	publishCmd.PersistentFlags().String("private-key", "", "the private key of for the client to use")

	publishCmd.PersistentFlags().String(
		"chain",
		"polygon-mumbai",
		`the tableland/evm to use, spported values are:
	etherum
	optimism
	polygon
	ethereum-goerli
	optimism-kovan
	optimism-goerli
	arbitrum-goerli
	polygon-mumbai
	localhost
    `,
	)

	publishCmd.PersistentFlags().String("tbl-api-url", "", "tableland validator api url if not providing --chain")
	publishCmd.PersistentFlags().Int64("chain-id", 0, "the chain id if not providing --chain")
	publishCmd.PersistentFlags().String("contract-addr", "", "the tableland contract address if not providing --chain")

	publishCmd.MarkFlagsRequiredTogether("tbl-api-url", "chain-id", "contract-addr")
	publishCmd.MarkFlagsMutuallyExclusive("chain", "tbl-api-url")
	publishCmd.MarkFlagsMutuallyExclusive("chain", "chain-id")
	publishCmd.MarkFlagsMutuallyExclusive("chain", "contract-addr")

	publishCmd.PersistentFlags().String("eth-api-url", "", "ethereum api url")
	publishCmd.PersistentFlags().String("infura-key", "", "api key for Infura")
	publishCmd.PersistentFlags().String("alchemy-key", "", "api key for Alchemy")

	publishCmd.MarkFlagsMutuallyExclusive("eth-api-url", "infura-key", "alchemy-key")
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

		wallet, err := wallet.NewWallet(viper.GetString("private-key"))
		checkErr(err)

		var chain client.Chain
		if viper.GetString("tbl-api-url") != "" {
			chain = client.Chain{
				Endpoint:     viper.GetString("tbl-api-url"),
				ID:           client.ChainID(viper.GetInt64("chain-id")),
				ContractAddr: common.HexToAddress(viper.GetString("contract-addr")),
			}
		} else {
			c, err := getChain()
			checkErr(err)
			chain = c
		}

		opts := []client.NewClientOption{client.NewClientChain(chain)}

		ethURL := viper.GetString("eth-api-url")
		infuraKey := viper.GetString("infura-key")
		alchemyKey := viper.GetString("alchemy-key")
		if ethURL != "" {
			_ethClient, err = ethclient.DialContext(ctx, ethURL)
			checkErr(err)
			opts = append(opts, client.NewClientContractBackend(_ethClient))
		} else if infuraKey != "" {
			opts = append(opts, client.NewClientInfuraAPIKey(infuraKey))
		} else if alchemyKey != "" {
			opts = append(opts, client.NewClientAlchemyAPIKey(alchemyKey))
		}

		tblClient, err = client.NewClient(ctx, wallet, opts...)
		checkErr(err)

		if viper.GetBool("to-tableland") {
			store = tableland.NewStore(tableland.Config{
				ChainID:        int64(chain.ID),
				TblClient:      tblClient,
				LocalStore:     localStore,
				ReceiptTimeout: viper.GetDuration("receipt-timeout"),
			})
		} else if viper.GetString("to-files") != "" {
			store, err = files.NewStore(files.Config{
				ChainID:    int64(chain.ID),
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
		tblClient.Close()
		if _db != nil {
			_ = _db.Close()
		}
		if _ethClient != nil {
			_ethClient.Close()
		}
	},
}

func getChain() (client.Chain, error) {
	chain := viper.GetString("chain")
	switch chain {
	case "etherum":
		return client.Chains.Ethereum, nil
	case "optimism":
		return client.Chains.Optimism, nil
	case "polygon":
		return client.Chains.Polygon, nil
	case "ethereum-goerli":
		return client.Chains.EthereumGoerli, nil
	case "optimism-kovan":
		return client.Chains.OptimismKovan, nil
	case "optimism-goerli":
		return client.Chains.OptimismGoerli, nil
	case "arbitrum-goerli":
		return client.Chains.ArbitrumGoerli, nil
	case "polygon-mumbai":
		return client.Chains.PolygonMumbai, nil
	case "local":
		return client.Chains.Local, nil
	default:
		return client.Chain{}, fmt.Errorf("%s is not a valid chain", chain)
	}
}
