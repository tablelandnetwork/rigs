package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/common"

	// Importing the sqlite driver.
	_ "github.com/mattn/go-sqlite3"
)

// Store implements Store using SQLite.
type Store struct {
	db      *sql.DB
	factory *common.SQLFactory
}

// NewStore creates a new SQLite store.
func NewStore(dbFile string, reset bool) (tableland.Store, error) {
	if reset {
		_ = os.Remove(dbFile)
	}
	db, err := sql.Open("sqlite3", dbFile)
	if err != nil {
		return nil, fmt.Errorf("opening db: %v", err)
	}

	return &Store{
		db:      db,
		factory: common.NewSQLFactory(goqu.Dialect("sqlite3")),
	}, nil
}

// CreateTable implements CreateTable.
func (s *Store) CreateTable(ctx context.Context, definition tableland.TableDefinition) (string, error) {
	statement := fmt.Sprintf("create table %s %s", definition.Prefix, definition.Schema)
	if _, err := s.db.Exec(statement); err != nil {
		return "", fmt.Errorf("creatingtable: %v", err)
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
func (s *Store) InsertRigs(ctx context.Context, gateway string, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingRigs(tableland.RigsDefinition.Prefix, gateway, rigs)
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

// ClearPartsData implements ClearPartsData.
func (s *Store) ClearPartsData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.PartsDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing parts data: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing parts data: %v", err)
	}
	return nil
}

// ClearLayersData implements ClearLayersData.
func (s *Store) ClearLayersData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.LayersDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing layers data: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing layers data: %v", err)
	}
	return nil
}

// ClearRigsData implements ClearRigsData.
func (s *Store) ClearRigsData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.RigsDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rigs data: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing rigs data: %v", err)
	}
	return nil
}

// ClearRigAttributesData implements ClearRigAttributesData.
func (s *Store) ClearRigAttributesData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(tableland.RigAttributesDefinition.Prefix)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rig attributes data: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("clearing rig attributes data: %v", err)
	}
	return nil
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return s.db.Close()
}
