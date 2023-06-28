package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland/common"

	// Importing the sqlite driver.
	_ "github.com/mattn/go-sqlite3"
)

// Store implements Store using SQLite.
type Store struct {
	db      *sql.DB
	factory *common.SQLFactory
}

// NewStore creates a new SQLite store.
func NewStore(db *sql.DB) (tableland.Store, error) {
	return &Store{
		db:      db,
		factory: common.NewSQLFactory(goqu.Dialect("sqlite3")),
	}, nil
}

// CreateTable implements CreateTable.
func (s *Store) CreateTable(ctx context.Context, definition tableland.TableDefinition) (string, error) {
	drop := fmt.Sprintf("drop table if exists %s", definition.Prefix)
	if _, err := s.db.ExecContext(ctx, drop); err != nil {
		return "", fmt.Errorf("dropping table: %v", err)
	}
	statement := fmt.Sprintf("create table %s %s strict", definition.Prefix, definition.Schema)
	if _, err := s.db.ExecContext(ctx, statement); err != nil {
		return "", fmt.Errorf("creating table: %v", err)
	}
	return definition.Prefix, nil
}

// InsertParts implements InsertParts.
func (s *Store) InsertParts(ctx context.Context, parts []local.Part) error {
	sql, err := s.factory.SQLForInsertingParts(tableland.PartsDefinition.Prefix, parts)
	if err != nil {
		return fmt.Errorf("getting sql for inserting parts: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("inserting parts: %v", err)
	}
	return nil
}

// InsertLayers implements InsertLayers.
func (s *Store) InsertLayers(ctx context.Context, layers []local.Layer) error {
	sql, err := s.factory.SQLForInsertingLayers(tableland.LayersDefinition.Prefix, layers)
	if err != nil {
		return fmt.Errorf("getting sql for inserting layers: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("inserting layers: %v", err)
	}
	return nil
}

// InsertRigs implements InsertRigs.
func (s *Store) InsertRigs(ctx context.Context, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingRigs(tableland.RigsDefinition.Prefix, rigs)
	if err != nil {
		return fmt.Errorf("getting sql for inserting rigs: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("inserting rigs: %v", err)
	}
	return nil
}

// InsertRigAttributes implements InsertRigAttributes.
func (s *Store) InsertRigAttributes(ctx context.Context, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingRigAttributes(tableland.RigAttributesDefinition.Prefix, rigs)
	if err != nil {
		return fmt.Errorf("getting sql for inserting rig attributes: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("inserting rig attributes: %v", err)
	}
	return nil
}

// InsertDeals implements InsertDeals.
func (s *Store) InsertDeals(ctx context.Context, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingDeals(tableland.DealsDefinition.Prefix, rigs)
	if err != nil {
		return fmt.Errorf("getting sql for inserting deals: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("inserting deals: %v", err)
	}
	return nil
}

// InsertLookups implements InsertLookups.
func (s *Store) InsertLookups(ctx context.Context, lookups tableland.Lookups) error {
	sql, err := s.factory.SQLForInsertingLookups(tableland.LookupsDefinition.Prefix, lookups)
	if err != nil {
		return fmt.Errorf("getting sql for inserting lookups: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("inserting lookups: %v", err)
	}
	return nil
}

// ClearParts implements ClearParts.
func (s *Store) ClearParts(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.PartsDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing parts: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing parts: %v", err)
	}
	return nil
}

// ClearLayers implements ClearLayers.
func (s *Store) ClearLayers(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.LayersDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing layers: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing layers: %v", err)
	}
	return nil
}

// ClearRigs implements ClearRigs.
func (s *Store) ClearRigs(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.RigsDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rigs: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing rigs: %v", err)
	}
	return nil
}

// ClearRigAttributes implements ClearRigAttributes.
func (s *Store) ClearRigAttributes(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.RigAttributesDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rig attributes: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing rig attributes: %v", err)
	}
	return nil
}

// ClearDeals implements ClearDeals.
func (s *Store) ClearDeals(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.DealsDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing deals: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing deals: %v", err)
	}
	return nil
}

// ClearLookups implements ClearLookups.
func (s *Store) ClearLookups(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.LookupsDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing lookups: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing lookups: %v", err)
	}
	return nil
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return s.db.Close()
}
