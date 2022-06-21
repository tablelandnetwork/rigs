package cmd

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	storage "github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/impl/sqlite"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/impl/tableland"
)

var store storage.Store

func init() {
	rootCmd.AddCommand(publishCmd)

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
	Short: "push rigs data to tableland",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		if err := rootCmd.PersistentPreRunE(cmd, args); err != nil {
			return fmt.Errorf("running root cmd persistent pre run: %v", err)
		}
		if err := viper.BindPFlags(cmd.Flags()); err != nil {
			return fmt.Errorf("error binding flags: %v", err)
		}
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
			if err != nil {
				return fmt.Errorf("creating tableland store: %v", err)
			}
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return nil
	},
}
