package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/common"

	// Importing the sqlite driver.
	_ "github.com/mattn/go-sqlite3"
)

const rigsSQLLengthLimit = 35000

// Store implements Store using SQLite.
type Store struct {
	db *sql.DB
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
		db: db,
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
	sql, err := common.SQLForInsertingParts(parts)
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
	sql, err := common.SQLForInsertingLayers(layers)
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
	sql, err := common.SQLForInsertingRigs(rigs)
	if err != nil {
		return fmt.Errorf("getting sql for inserting rig: %v", err)
	}
	if len(sql) > rigsSQLLengthLimit {
		return fmt.Errorf("sql query length of %d is longer than limit of %d", len(sql), rigsSQLLengthLimit)
	}
	if _, err := s.db.ExecContext(ctx, sql); err != nil {
		return fmt.Errorf("inserting rig: %v", err)
	}
	return nil
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return s.db.Close()
}
