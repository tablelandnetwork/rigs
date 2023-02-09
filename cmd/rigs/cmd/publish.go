package cmd

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/carstorage"
	"github.com/tablelandnetwork/rigs/pkg/carstorage/nftstorage"
	"github.com/tablelandnetwork/rigs/pkg/carstorage/web3storage"
	"github.com/tablelandnetwork/rigs/pkg/publisher"
	storage "github.com/tablelandnetwork/rigs/pkg/storage/tableland"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/impl/files"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/impl/sqlite"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/impl/tableland"
	"github.com/textileio/go-tableland/pkg/client"
	"github.com/textileio/go-tableland/pkg/wallet"
)

var (
	_db *sql.DB

	ethClient *ethclient.Client
	pub       *publisher.Publisher
	store     storage.Store
	tblClient *client.Client
	chain     client.Chain
)

func init() {
	rootCmd.AddCommand(publishCmd)

	publishCmd.PersistentFlags().String("nft-storage-key", "", "api key for nft.storage")
	publishCmd.PersistentFlags().String("web3-storage-key", "", "api key for web3.storage")
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
	publishCmd.PersistentFlags().String("tbl-db-path", "./tableland.db", "path to the local tableland sqlite db file")
	publishCmd.PersistentFlags().String("private-key", "", "the private key of for the client to use")

	publishCmd.PersistentFlags().String(
		"chain",
		"polygon-mumbai",
		`the tableland/evm to use, spported values are:
	ethereum
	optimism
	arbitrum
	polygon
	ethereum-goerli
	optimism-goerli
	arbitrum-goerli
	polygon-mumbai
	local
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

	publishCmd.PersistentFlags().Bool("relay-writes", false, "whether or not to relay writes through the validator")
}

var publishCmd = &cobra.Command{
	Use:   "publish",
	Short: "Push rigs data to tableland and remote IPFS",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		rootCmd.PersistentPreRun(cmd, args)

		var err error

		nftStorageKey := viper.GetString("nft-storage-key")
		web3StorageKey := viper.GetString("web3-storage-key")

		if (nftStorageKey == "" && web3StorageKey == "") || (nftStorageKey != "" && web3StorageKey != "") {
			checkErr(errors.New("must provide either --nft-storage-key or --web3-storage-key"))
		}

		var carStorage carstorage.CarStorage
		if nftStorageKey != "" {
			carStorage = nftstorage.NewClient(nftStorageKey)
		} else {
			carStorage, err = web3storage.NewClient(web3StorageKey)
			checkErr(err)
		}

		pub = publisher.NewPublisher(localStore, ipfsClient, carStorage)

		wallet, err := wallet.NewWallet(viper.GetString("private-key"))
		checkErr(err)

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

		opts := []client.NewClientOption{
			client.NewClientChain(chain),
			client.NewClientRelayWrites(viper.GetBool("relay-writes")),
		}

		ethURL := viper.GetString("eth-api-url")
		infuraKey := viper.GetString("infura-key")
		alchemyKey := viper.GetString("alchemy-key")
		if ethURL != "" {
			ethClient, err = ethclient.DialContext(ctx, ethURL)
			checkErr(err)
			opts = append(opts, client.NewClientContractBackend(ethClient))
		} else if infuraKey != "" {
			opts = append(opts, client.NewClientInfuraAPIKey(infuraKey))
			ethClient, err = ethclient.DialContext(ctx, fmt.Sprintf(infuraURLs[chain.ID], infuraKey))
			checkErr(err)
		} else if alchemyKey != "" {
			opts = append(opts, client.NewClientAlchemyAPIKey(alchemyKey))
			ethClient, err = ethclient.DialContext(ctx, fmt.Sprintf(alchemyURLs[chain.ID], alchemyKey))
			checkErr(err)
		} else if chain.ID == client.ChainIDs.Local {
			ethClient, err = ethclient.DialContext(ctx, localURLs[chain.ID])
			checkErr(err)
		}

		tblClient, err = client.NewClient(ctx, wallet, opts...)
		checkErr(err)

		if viper.GetBool("to-tableland") {
			store = tableland.NewStore(tableland.Config{
				ChainID:        int64(chain.ID),
				TblClient:      tblClient,
				LocalStore:     localStore,
				EthClient:      ethClient,
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
		if ethClient != nil {
			ethClient.Close()
		}
	},
}

func getChain() (client.Chain, error) {
	chain := viper.GetString("chain")
	switch chain {
	case "ethereum":
		return client.Chains.Ethereum, nil
	case "optimism":
		return client.Chains.Optimism, nil
	case "arbitrum":
		return client.Chains.Arbitrum, nil
	case "polygon":
		return client.Chains.Polygon, nil
	case "ethereum-goerli":
		return client.Chains.EthereumGoerli, nil
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

var infuraURLs = map[client.ChainID]string{
	client.ChainIDs.EthereumGoerli: "https://goerli.infura.io/v3/%s",
	client.ChainIDs.Ethereum:       "https://mainnet.infura.io/v3/%s",
	client.ChainIDs.OptimismGoerli: "https://optimism-goerli.infura.io/v3/%s",
	client.ChainIDs.Optimism:       "https://optimism-mainnet.infura.io/v3/%s",
	client.ChainIDs.ArbitrumGoerli: "https://arbitrim-goerli.infura.io/v3/%s",
	client.ChainIDs.Arbitrum:       "https://arbitrum-mainnet.infura.io/v3/%s",
	client.ChainIDs.PolygonMumbai:  "https://polygon-mumbai.infura.io/v3/%s",
	client.ChainIDs.Polygon:        "https://polygon-mainnet.infura.io/v3/%s",
}

var alchemyURLs = map[client.ChainID]string{
	client.ChainIDs.EthereumGoerli: "https://eth-goerli.g.alchemy.com/v2/%s",
	client.ChainIDs.Ethereum:       "https://eth-mainnet.g.alchemy.com/v2/%s",
	client.ChainIDs.OptimismGoerli: "https://opt-goerli.g.alchemy.com/v2/%s",
	client.ChainIDs.Optimism:       "https://opt-mainnet.g.alchemy.com/v2/%s",
	client.ChainIDs.ArbitrumGoerli: "https://arb-goerli.g.alchemy.com/v2/%s",
	client.ChainIDs.Arbitrum:       "https://arb-mainnet.g.alchemy.com/v2/%s",
	client.ChainIDs.PolygonMumbai:  "https://polygon-mumbai.g.alchemy.com/v2/%s",
	client.ChainIDs.Polygon:        "https://polygon-mainnet.g.alchemy.com/v2/%s",
}

var localURLs = map[client.ChainID]string{
	client.ChainIDs.Local: "http://localhost:8545",
}
