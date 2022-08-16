package tableland

import (
	"context"
	"fmt"
	"time"

	"github.com/doug-martin/goqu/v9"
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
	localStore     local.Store
	receiptTimeout time.Duration
	factory        *common.SQLFactory
}

// Config confitures a new Store.
type Config struct {
	ChainID        int64
	TblClient      *client.Client
	LocalStore     local.Store
	ReceiptTimeout time.Duration
}

// NewStore creates a new Store.
func NewStore(c Config) tableland.Store {
	return &Store{
		chainID:        c.ChainID,
		tblClient:      c.TblClient,
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
	return s.writeSQL(ctx, sql)
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
	return s.writeSQL(ctx, sql)
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
	return s.writeSQL(ctx, sql)
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
	return s.writeSQL(ctx, sql)
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
	return s.writeSQL(ctx, sql)
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
	return s.writeSQL(ctx, sql)
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
	return s.writeSQL(ctx, sql)
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
	return s.writeSQL(ctx, sql)
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return nil
}

func (s *Store) writeSQL(ctx context.Context, sql string) error {
	hash, err := s.tblClient.Write(ctx, sql)
	if err != nil {
		return fmt.Errorf("calling write: %v", err)
	}
	receipt, found, err := s.tblClient.Receipt(ctx, hash, client.WaitFor(s.receiptTimeout))
	if err != nil {
		return fmt.Errorf("getting receipt for txn %s: %v", hash, err)
	}
	if !found {
		return fmt.Errorf("timed out before getting receipt for txn %s", hash)
	}
	if receipt.Error != "" {
		return fmt.Errorf("error processing txn %s: %s", receipt.TxnHash, receipt.Error)
	}
	return nil
}
