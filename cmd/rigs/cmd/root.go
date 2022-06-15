package cmd

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/textileio/go-tableland/pkg/client"
	"github.com/textileio/go-tableland/pkg/wallet"
)

var (
	ipfsClient *httpapi.HttpApi
	tblClient  *client.Client
)

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().String("ipfs-api-url", "http://127.0.0.1:5001", "address of the local ipfs api")
	rootCmd.PersistentFlags().String("api-url", "http://localhost:8080", "tableland validator api url")
	rootCmd.PersistentFlags().String("eth-api-url", "http://localhost:8545", "ethereum api url")
	rootCmd.PersistentFlags().Int64("chain-id", 31337, "the chain id")
	rootCmd.PersistentFlags().String("contract-addr", "", "the tableland contract address")
	rootCmd.PersistentFlags().String("private-key", "", "the private key of for the client to use")
}

var rootCmd = &cobra.Command{
	Use:   "rigs",
	Short: "Rigs creates Rig data, builds Rigs, and publishes Rigs to Tableland and IPFS",
	Long:  "Rigs creates Rig data, builds Rigs, and publishes Rigs to Tableland and IPFS",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		if err := viper.BindPFlags(cmd.Flags()); err != nil {
			return fmt.Errorf("error binding flags: %v", err)
		}

		httpClient := &http.Client{}

		ipfs, err := httpapi.NewURLApiWithClient(viper.GetString("ipfs-api-url"), httpClient)
		if err != nil {
			return fmt.Errorf("error creating ipfs client: %v", err)
		}
		ipfsClient = ipfs

		ethClient, err := ethclient.Dial(viper.GetString("eth-api-url"))
		if err != nil {
			return fmt.Errorf("error creating eth client: %v", err)
		}

		wallet, err := wallet.NewWallet(viper.GetString("private-key"))
		if err != nil {
			return fmt.Errorf("error creating wallet: %v", err)
		}
		config := client.Config{
			TblAPIURL:    viper.GetString("api-url"),
			EthBackend:   ethClient,
			ChainID:      client.ChainID(viper.GetInt64("chain-id")),
			ContractAddr: common.HexToAddress(viper.GetString("contract-addr")),
			Wallet:       wallet,
		}
		tblClient, err = client.NewClient(cmd.Context(), config)
		if err != nil {
			return fmt.Errorf("error creating tbl client: %v", err)
		}
		return nil
	},
}

// Execute executes the command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func initConfig() {
	viper.SetEnvPrefix("TBL")
	viper.AutomaticEnv()
	replacer := strings.NewReplacer("-", "_")
	viper.SetEnvKeyReplacer(replacer)
}
