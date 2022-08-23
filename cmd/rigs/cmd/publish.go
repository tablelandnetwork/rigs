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
		"network",
		"testnet:polygon-mumbai",
		`the tableland network to use, spported values are:
	testnet:etherum
	testnet:optimism
	testnet:polygon
	testnet:ethereum-goerli
	testnet:optimism-kovan
	testnet:optimism-goerli
	testnet:arbitrum-goerli
	testnet:polygon-mumbai
	staging:optimism-kovan
	staging:optimism-goerli
	localhost:local
    `,
	)

	publishCmd.PersistentFlags().String("tbl-api-url", "", "tableland validator api url if not providing --network")
	publishCmd.PersistentFlags().Int64("chain-id", 0, "the chain id if not providing --network")
	publishCmd.PersistentFlags().String("contract-addr", "", "the tableland contract address if not providing --network")

	publishCmd.MarkFlagsRequiredTogether("tbl-api-url", "chain-id", "contract-addr")
	publishCmd.MarkFlagsMutuallyExclusive("network", "tbl-api-url")
	publishCmd.MarkFlagsMutuallyExclusive("network", "chain-id")
	publishCmd.MarkFlagsMutuallyExclusive("network", "contract-addr")

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

		var network client.NetworkInfo
		if viper.GetString("tbl-api-url") != "" {
			network = client.NetworkInfo{
				Network:      client.Network(viper.GetString("tbl-api-url")),
				ChainID:      client.ChainID(viper.GetInt64("chain-id")),
				ContractAddr: common.HexToAddress(viper.GetString("contract-addr")),
			}
		} else {
			n, err := getNetworkInfo()
			checkErr(err)
			network = n
		}

		opts := []client.NewClientOption{client.NewClientNetworkInfo(network)}

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
				ChainID:        int64(network.ChainID),
				TblClient:      tblClient,
				LocalStore:     localStore,
				ReceiptTimeout: viper.GetDuration("receipt-timeout"),
			})
		} else if viper.GetString("to-files") != "" {
			store, err = files.NewStore(files.Config{
				ChainID:    int64(network.ChainID),
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

func getNetworkInfo() (client.NetworkInfo, error) {
	network := viper.GetString("network")
	switch network {
	case "testnet:etherum":
		return client.TestnetEtherum, nil
	case "testnet:optimism":
		return client.TestnetOptimism, nil
	case "testnet:polygon":
		return client.TestnetPolygon, nil
	case "testnet:ethereum-goerli":
		return client.TestnetEthereumGoerli, nil
	case "testnet:optimism-kovan":
		return client.TestnetOptimismKovan, nil
	case "testnet:optimism-goerli":
		return client.TestnetOptimismGoerli, nil
	case "testnet:arbitrum-goerli":
		return client.TestnetArbitrumGoerli, nil
	case "testnet:polygon-mumbai":
		return client.TestnetPolygonMumbai, nil
	case "staging:optimism-kovan":
		return client.StagingOptimismKovan, nil
	case "staging:optimism-goerli":
		return client.StagingOptimismGoerli, nil
	case "localhost:local":
		return client.LocalhostLocal, nil
	default:
		return client.NetworkInfo{}, fmt.Errorf("%s is not a valid network", network)
	}
}
