package files

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/common"
)

const dialect = "sqlite3"

// Store implements Store using the Tableland client.
type Store struct {
	chainID    int64
	localStore local.Store
	outPath    string
	factory    *common.SQLFactory
	lock       sync.Mutex
	count      int
}

// Config confitures a new Store.
type Config struct {
	ChainID    int64
	LocalStore local.Store
	OutPath    string
}

// NewStore creates a new Store.
func NewStore(c Config) (tableland.Store, error) {
	if err := os.MkdirAll(c.OutPath, os.ModePerm); err != nil {
		return nil, fmt.Errorf("creating files path: %v", err)
	}
	return &Store{
		chainID:    c.ChainID,
		localStore: c.LocalStore,
		outPath:    c.OutPath,
		factory:    common.NewSQLFactory(goqu.Dialect(dialect)),
	}, nil
}

// CreateTable implements CreateTable.
func (s *Store) CreateTable(_ context.Context, _ tableland.TableDefinition) (string, error) {
	return "", errors.New("CreateTable not implemented")
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
	return s.writeSQL("parts", sql)
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
	return s.writeSQL("layers", sql)
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
	return s.writeSQL("rig-attributes", sql)
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
	return s.writeSQL("lookups", sql)
}

// ClearParts implements ClearParts.
func (s *Store) ClearParts(_ context.Context) error {
	return errors.New("ClearParts not implemented")
}

// ClearLayers implements ClearLayers.
func (s *Store) ClearLayers(_ context.Context) error {
	return errors.New("ClearLayers not implemented")
}

// ClearRigAttributes implements ClearRigAttributes.
func (s *Store) ClearRigAttributes(_ context.Context) error {
	return errors.New("ClearRigAttributes not implemented")
}

// ClearLookups implements ClearLookups.
func (s *Store) ClearLookups(_ context.Context) error {
	return errors.New("ClearLookups not implemented")
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return nil
}

func (s *Store) writeSQL(category, sql string) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	filename := fmt.Sprintf("%s/%02d_%s.sql", s.outPath, s.count, category)

	if err := os.WriteFile(filename, []byte(sql), 0o644); err != nil {
		return err
	}
	s.count++
	return nil
}
