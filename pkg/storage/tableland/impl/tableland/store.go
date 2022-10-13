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
func (s *Store) InsertLayers(ctx context.Context, layers []local.Layer) error {
	tableName, err := s.localStore.TableName(ctx, "layers", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingLayers(tableName, layers)
	if err != nil {
		return fmt.Errorf("getting sql to insert layers: %v", err)
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

// InsertLookups implements InsertLookups.
func (s *Store) InsertLookups(ctx context.Context, lookups tableland.Lookups) error {
	tableName, err := s.localStore.TableName(ctx, "lookups", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForInsertingLookups(tableName, lookups)
	if err != nil {
		return fmt.Errorf("getting sql to insert lookups: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearParts implements ClearParts.
func (s *Store) ClearParts(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "parts", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing parts: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearLayers implements ClearLayers.
func (s *Store) ClearLayers(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "layers", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing layers: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearRigAttributes implements ClearRigAttributes.
func (s *Store) ClearRigAttributes(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "rig_attributes", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rig attributes: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearLookups implements ClearLookups.
func (s *Store) ClearLookups(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "lookups", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing lookups: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearPilotSessions implements ClearPilotSessions.
func (s *Store) ClearPilotSessions(ctx context.Context) error {
	tableName, err := s.localStore.TableName(ctx, "pilot_sessions", s.chainID)
	if err != nil {
		return fmt.Errorf("getting table name: %v", err)
	}
	sql, err := s.factory.SQLForClearingData(tableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing pilot sessions: %v", err)
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
