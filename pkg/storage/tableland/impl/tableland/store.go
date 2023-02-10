package tableland

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/doug-martin/goqu/v9"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/common"
	"github.com/textileio/go-tableland/pkg/client"
)

const dialect = "sqlite3"

// Store implements Store using the Tableland client.
type Store struct {
	chainID        int64
	tblClient      *client.Client
	ethClient      *ethclient.Client
	localStore     local.Store
	receiptTimeout time.Duration
	factory        *common.SQLFactory
}

// Config confitures a new Store.
type Config struct {
	ChainID        int64
	TblClient      *client.Client
	EthClient      *ethclient.Client
	LocalStore     local.Store
	ReceiptTimeout time.Duration
}

// NewStore creates a new Store.
func NewStore(c Config) tableland.Store {
	return &Store{
		chainID:        c.ChainID,
		tblClient:      c.TblClient,
		ethClient:      c.EthClient,
		localStore:     c.LocalStore,
		receiptTimeout: c.ReceiptTimeout,
		factory:        common.NewSQLFactory(goqu.Dialect(dialect)),
	}
}

// CreateTable implements CreateTable.
func (s *Store) CreateTable(ctx context.Context, definition tableland.TableDefinition) (string, error) {
	_, tableName, err := s.tblClient.Create(
		ctx,
		definition.Schema,
		client.WithPrefix(definition.Prefix),
		client.WithReceiptTimeout(s.receiptTimeout),
	)
	if err != nil {
		return "", fmt.Errorf("creating table with client: %v", err)
	}
	if err := s.localStore.TrackTableName(ctx, definition.Prefix, s.chainID, tableName); err != nil {
		return "", fmt.Errorf("tracking table name: %v", err)
	}
	return tableName, nil
}

// InsertParts implements InsertParts.
func (s *Store) InsertParts(ctx context.Context, parts []local.Part) error {
	tableName, err := s.localStore.TableName(ctx, tableland.PartsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingParts(tableName, parts)
	if err != nil {
		return fmt.Errorf("getting sql to insert parts: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, tableland.PartsDefinition.Prefix, sql)
}

// InsertLayers implements InsertLayers.
func (s *Store) InsertLayers(ctx context.Context, layers []local.Layer) error {
	tableName, err := s.localStore.TableName(ctx, tableland.LayersDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingLayers(tableName, layers)
	if err != nil {
		return fmt.Errorf("getting sql to insert layers: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, tableland.LayersDefinition.Prefix, sql)
}

func (s *Store) InsertRigs(ctx context.Context, rigs []local.Rig) error {
	tableName, err := s.localStore.TableName(ctx, tableland.RigsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingRigs(tableName, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert rigs: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, tableland.RigsDefinition.Prefix, sql)
}

// InsertRigAttributes implements InsertRigAttributes.
func (s *Store) InsertRigAttributes(ctx context.Context, rigs []local.Rig) error {
	tableName, err := s.localStore.TableName(ctx, tableland.RigAttributesDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingRigAttributes(tableName, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert rig attributes: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, tableland.RigAttributesDefinition.Prefix, sql)
}

func (s *Store) InsertDeals(ctx context.Context, rigs []local.Rig) error {
	tableName, err := s.localStore.TableName(ctx, tableland.DealsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingDeals(tableName, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert deals: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, tableland.DealsDefinition.Prefix, sql)
}

// InsertLookups implements InsertLookups.
func (s *Store) InsertLookups(ctx context.Context, lookups tableland.Lookups) error {
	tableName, err := s.localStore.TableName(ctx, tableland.LookupsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingLookups(tableName, lookups)
	if err != nil {
		return fmt.Errorf("getting sql to insert lookups: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, tableland.LookupsDefinition.Prefix, sql)
}

// ClearParts implements ClearParts.
func (s *Store) ClearParts(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, tableland.PartsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing parts: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, tableland.PartsDefinition.Prefix, s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearLayers implements ClearLayers.
func (s *Store) ClearLayers(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, tableland.LayersDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing layers: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, tableland.LayersDefinition.Prefix, s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearRigs implements ClearRigs.
func (s *Store) ClearRigs(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, tableland.RigsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rigs: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, tableland.RigsDefinition.Prefix, s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearRigAttributes implements ClearRigAttributes.
func (s *Store) ClearRigAttributes(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, tableland.RigAttributesDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rig attributes: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, tableland.RigAttributesDefinition.Prefix, s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearDeals implements ClearDeals.
func (s *Store) ClearDeals(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, tableland.DealsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing deals: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, tableland.DealsDefinition.Prefix, s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearLookups implements ClearLookups.
func (s *Store) ClearLookups(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, tableland.LookupsDefinition.Prefix, s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing lookups: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, tableland.LookupsDefinition.Prefix, s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return nil
}

func (s *Store) writeSQL(ctx context.Context, sql string) (string, error) {
	hash, err := s.tblClient.Write(ctx, sql)
	if err != nil {
		return "", fmt.Errorf("calling write: %v", err)
	}
	receipt, found, err := s.tblClient.Receipt(ctx, hash, client.WaitFor(s.receiptTimeout))
	if err != nil {
		return "", fmt.Errorf("getting receipt for txn %s: %v", hash, err)
	}
	if !found {
		return "", fmt.Errorf("timed out before getting receipt for txn %s", hash)
	}
	if receipt.Error != "" {
		return "", fmt.Errorf("error processing txn %s: %s", receipt.TxnHash, receipt.Error)
	}
	return hash, nil
}

func (s *Store) trackTxn(ctx context.Context, hash, tableLabel, sql string) error {
	h := ethcommon.HexToHash(hash)
	t, pending, err := s.ethClient.TransactionByHash(ctx, h)
	if err != nil {
		return fmt.Errorf("getting eth transaction: %v", err)
	}
	if pending {
		return errors.New("can't get receipt for pending txn")
	}
	r, err := s.ethClient.TransactionReceipt(ctx, h)
	if err != nil {
		return fmt.Errorf("getting eth transaction receipt: %v", err)
	}
	if err := s.localStore.TrackTxn(
		ctx,
		hash,
		tableLabel,
		s.chainID,
		"insert",
		sql,
		int64(r.GasUsed),
		t.GasPrice().Int64(),
	); err != nil {
		return fmt.Errorf("tracking transaction: %v", err)
	}
	return nil
}
