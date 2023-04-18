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
	chains "github.com/textileio/go-tableland/pkg/client"
	client "github.com/textileio/go-tableland/pkg/client/v1"
	"github.com/textileio/go-tableland/pkg/wallet"
)

var (
	_db *sql.DB

	ethClient    *ethclient.Client
	dirPublisher *dirpublisher.DirPublisher
	store        storage.Store
	tblClient    *client.Client
	chain        chains.Chain
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
}

var publishCmd = &cobra.Command{
	Use:   "publish",
	Short: "Push rigs data to tableland and remote IPFS",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		rootCmd.PersistentPreRun(cmd, args)

		var err error

		nftStorage := nftstorage.NewClient(viper.GetString("nft-storage-key"))
		dirPublisher = dirpublisher.NewDirPublisher(localStore, ipfsClient, nftStorage)

		wallet, err := wallet.NewWallet(viper.GetString("private-key"))
		checkErr(err)

		if viper.GetString("tbl-api-url") != "" {
			chain = chains.Chain{
				Endpoint:     viper.GetString("tbl-api-url"),
				ID:           chains.ChainID(viper.GetInt64("chain-id")),
				ContractAddr: common.HexToAddress(viper.GetString("contract-addr")),
			}
		} else {
			c, err := getChain()
			checkErr(err)
			chain = c
		}

		opts := []client.NewClientOption{
			client.NewClientChain(chain),
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
		} else if chain.ID == chains.ChainIDs.Local {
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
		if _db != nil {
			_ = _db.Close()
		}
		if ethClient != nil {
			ethClient.Close()
		}
	},
}

func getChain() (chains.Chain, error) {
	chain := viper.GetString("chain")
	switch chain {
	case "ethereum":
		return chains.Chains[chains.ChainIDs.Ethereum], nil
	case "optimism":
		return chains.Chains[chains.ChainIDs.Optimism], nil
	case "arbitrum":
		return chains.Chains[chains.ChainIDs.Arbitrum], nil
	case "polygon":
		return chains.Chains[chains.ChainIDs.Polygon], nil
	case "ethereum-goerli":
		return chains.Chains[chains.ChainIDs.EthereumGoerli], nil
	case "optimism-goerli":
		return chains.Chains[chains.ChainIDs.OptimismGoerli], nil
	case "arbitrum-goerli":
		return chains.Chains[chains.ChainIDs.ArbitrumGoerli], nil
	case "polygon-mumbai":
		return chains.Chains[chains.ChainIDs.PolygonMumbai], nil
	case "local":
		return chains.Chains[chains.ChainIDs.Local], nil
	default:
		return chains.Chain{}, fmt.Errorf("%s is not a valid chain", chain)
	}
}

var infuraURLs = map[chains.ChainID]string{
	chains.ChainIDs.EthereumGoerli: "https://goerli.infura.io/v3/%s",
	chains.ChainIDs.Ethereum:       "https://mainnet.infura.io/v3/%s",
	chains.ChainIDs.OptimismGoerli: "https://optimism-goerli.infura.io/v3/%s",
	chains.ChainIDs.Optimism:       "https://optimism-mainnet.infura.io/v3/%s",
	chains.ChainIDs.ArbitrumGoerli: "https://arbitrim-goerli.infura.io/v3/%s",
	chains.ChainIDs.Arbitrum:       "https://arbitrum-mainnet.infura.io/v3/%s",
	chains.ChainIDs.PolygonMumbai:  "https://polygon-mumbai.infura.io/v3/%s",
	chains.ChainIDs.Polygon:        "https://polygon-mainnet.infura.io/v3/%s",
}

var alchemyURLs = map[chains.ChainID]string{
	chains.ChainIDs.EthereumGoerli: "https://eth-goerli.g.alchemy.com/v2/%s",
	chains.ChainIDs.Ethereum:       "https://eth-mainnet.g.alchemy.com/v2/%s",
	chains.ChainIDs.OptimismGoerli: "https://opt-goerli.g.alchemy.com/v2/%s",
	chains.ChainIDs.Optimism:       "https://opt-mainnet.g.alchemy.com/v2/%s",
	chains.ChainIDs.ArbitrumGoerli: "https://arb-goerli.g.alchemy.com/v2/%s",
	chains.ChainIDs.Arbitrum:       "https://arb-mainnet.g.alchemy.com/v2/%s",
	chains.ChainIDs.PolygonMumbai:  "https://polygon-mumbai.g.alchemy.com/v2/%s",
	chains.ChainIDs.Polygon:        "https://polygon-mainnet.g.alchemy.com/v2/%s",
}

var localURLs = map[chains.ChainID]string{
	chains.ChainIDs.Local: "http://localhost:8545",
}
