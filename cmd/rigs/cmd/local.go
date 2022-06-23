package cmd

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/textileio/go-tableland/pkg/client"
	"github.com/textileio/go-tableland/pkg/wallet"
)

var tblClient *client.Client

func init() {
	rootCmd.AddCommand(localCmd)

	localCmd.PersistentFlags().String("api-url", "http://localhost:8080", "tableland validator api url")
	localCmd.PersistentFlags().String("eth-api-url", "http://localhost:8545", "ethereum api url")
	localCmd.PersistentFlags().Int64("chain-id", 31337, "the chain id")
	localCmd.PersistentFlags().String("contract-addr", "", "the tableland contract address")
	localCmd.PersistentFlags().String("private-key", "", "the private key of for the client to use")
}

var localCmd = &cobra.Command{
	Use:   "local",
	Short: "Commands for generating and interacting with rigs data locally",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		rootCmd.PersistentPreRun(cmd, args)

		ethClient, err := ethclient.Dial(viper.GetString("eth-api-url"))
		checkErr(err)

		wallet, err := wallet.NewWallet(viper.GetString("private-key"))
		checkErr(err)
		config := client.Config{
			TblAPIURL:    viper.GetString("api-url"),
			EthBackend:   ethClient,
			ChainID:      client.ChainID(viper.GetInt64("chain-id")),
			ContractAddr: common.HexToAddress(viper.GetString("contract-addr")),
			Wallet:       wallet,
		}
		tblClient, err = client.NewClient(ctx, config)
		checkErr(err)
	},
}
