package tableland

import (
	"context"
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
	tableName, err := s.localStore.TableName(ctx, "parts", s.chainID)
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
	return s.trackTxn(ctx, hash, "parts", sql)
}

// InsertLayers implements InsertLayers.
func (s *Store) InsertLayers(ctx context.Context, cid string, layers []local.Layer) error {
	tableName, err := s.localStore.TableName(ctx, "layers", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingLayers(tableName, cid, layers)
	if err != nil {
		return fmt.Errorf("getting sql to insert layers: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, "layers", sql)
}

// InsertRigs implements InsertRigs.
func (s *Store) InsertRigs(ctx context.Context, cid string, rigs []local.Rig) error {
	tableName, err := s.localStore.TableName(ctx, "rigs", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingRigs(tableName, cid, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert rigs: %v", err)
	}
	hash, err := s.writeSQL(ctx, sql)
	if err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	return s.trackTxn(ctx, hash, "rigs", sql)
}

// InsertRigAttributes implements InsertRigAttributes.
func (s *Store) InsertRigAttributes(ctx context.Context, rigs []local.Rig) error {
	tableName, err := s.localStore.TableName(ctx, "rig_attributes", s.chainID)
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
	return s.trackTxn(ctx, hash, "rig_attributes", sql)
}

// ClearPartsData implements ClearPartsData.
func (s *Store) ClearPartsData(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "parts", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing parts data: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, "parts", s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearLayersData implements ClearLayersData.
func (s *Store) ClearLayersData(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "layers", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing layers data: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, "layers", s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearRigsData implements ClearRigsData.
func (s *Store) ClearRigsData(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "rigs", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rigs data: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, "rigs", s.chainID, "insert"); err != nil {
		return fmt.Errorf("clearning txns: %v", err)
	}
	return nil
}

// ClearRigAttributesData implements ClearRigAttributesData.
func (s *Store) ClearRigAttributesData(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "rig_attributes", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rig attributes data: %v", err)
	}
	if _, err := s.writeSQL(ctx, sql); err != nil {
		return fmt.Errorf("writing SQL: %v", err)
	}
	if err := s.localStore.ClearTxns(ctx, "rig_attributes", s.chainID, "insert"); err != nil {
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
	tx, _, err := s.ethClient.TransactionByHash(ctx, ethcommon.HexToHash(hash))
	if err != nil {
		return fmt.Errorf("getting eth transaction: %v", err)
	}
	if err := s.localStore.TrackTxn(ctx, hash, tableLabel, s.chainID, "insert", sql, tx.Cost().Int64()); err != nil {
		return fmt.Errorf("tracking transaction: %v", err)
	}
	return nil
}
