package cmd

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"strings"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
)

var (
	localDB    *sql.DB
	localStore local.Store
	ipfsClient *httpapi.HttpApi
)

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().String("local-db-path", "", "path the the sqlite local db file")
	rootCmd.PersistentFlags().String("ipfs-api-url", "http://127.0.0.1:5001", "address of the local ipfs api")
}

var rootCmd = &cobra.Command{
	Use:   "rigs",
	Short: "Rigs creates Rig data, builds Rigs, and publishes Rigs to Tableland and IPFS",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		var err error
		ctx := cmd.Context()

		checkErr(viper.BindPFlags(cmd.Flags()))

		localDB, err = sql.Open("sqlite3", viper.GetString("local-db-path"))
		checkErr(err)
		localStore, err = impl.NewStore(ctx, localDB)
		checkErr(err)

		httpClient := &http.Client{}
		ipfsClient, err = httpapi.NewURLApiWithClient(viper.GetString("ipfs-api-url"), httpClient)
		checkErr(err)
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		_ = localDB.Close()
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
	viper.SetEnvPrefix("NFT")
	viper.AutomaticEnv()
	replacer := strings.NewReplacer("-", "_")
	viper.SetEnvKeyReplacer(replacer)
}

func checkErr(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}
