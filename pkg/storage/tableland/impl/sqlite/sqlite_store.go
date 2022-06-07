package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/common"

	// Importing the sqlite driver.
	_ "github.com/mattn/go-sqlite3"
)

const rigsSQLLengthLimit = 35000

// SQLiteStore implements Store using SQLite.
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore creates a new SQLite store.
func NewSQLiteStore(dbFile string, reset bool) (*SQLiteStore, error) {
	if reset {
		_ = os.Remove(dbFile)
	}
	db, err := sql.Open("sqlite3", dbFile)
	if err != nil {
		return nil, fmt.Errorf("opening db: %v", err)
	}

	return &SQLiteStore{
		db: db,
	}, nil
}

// CreateTables implements CreateTables.
func (s *SQLiteStore) CreateTables(ctx context.Context) error {
	if _, err := s.db.Exec(common.CreatePartsTableSQL); err != nil {
		return fmt.Errorf("creating parts table: %v", err)
	}
	if _, err := s.db.Exec(common.CreateLayersTableSQL); err != nil {
		return fmt.Errorf("creating layers table: %v", err)
	}
	if _, err := s.db.Exec(common.CreateRigsTableSQL); err != nil {
		return fmt.Errorf("creating rigs table: %v", err)
	}
	if _, err := s.db.Exec(common.CreateRigAttributesTableSQL); err != nil {
		return fmt.Errorf("creating rig attributes table: %v", err)
	}
	return nil
}

// InsertParts implements InsertParts.
func (s *SQLiteStore) InsertParts(ctx context.Context, parts []tableland.Part) error {
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
func (s *SQLiteStore) InsertLayers(ctx context.Context, layers []tableland.Layer) error {
	if _, err := s.db.ExecContext(ctx, common.SQLForInsertingLayers(layers)); err != nil {
		return fmt.Errorf("inserting layers: %v", err)
	}
	return nil
}

// InsertRigs implements InsertRigs.
func (s *SQLiteStore) InsertRigs(ctx context.Context, rigs []tableland.Rig) error {
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

// GetOriginalRigs implements GetOriginalRigs.
func (s *SQLiteStore) GetOriginalRigs(ctx context.Context) ([]tableland.OriginalRig, error) {
	ss := common.SQLForGettingOriginalRigs()
	rows, err := s.db.QueryContext(ctx, ss)
	if err != nil {
		return nil, fmt.Errorf("querying for original rigs: %v", err)
	}

	var originals []tableland.OriginalRig
	for rows.Next() {
		var o tableland.OriginalRig
		if err := rows.Scan(&o.Fleet, &o.Name, &o.Color); err != nil {
			return nil, fmt.Errorf("scanning row into original rig: %v", err)
		}
		originals = append(originals, o)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("processing oringinal rigs query results: %v", err)
	}
	return originals, nil
}

// GetPartTypesByFleet implements GetPartTypesByFleet.
func (s *SQLiteStore) GetPartTypesByFleet(ctx context.Context, fleet string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, common.SQLForGettingPartTypesByFleet(fleet))
	if err != nil {
		return nil, fmt.Errorf("querying for fleet part types: %v", err)
	}

	var types []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, fmt.Errorf("scanning row into type string: %v", err)
		}
		types = append(types, t)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("processing part types query results: %v", err)
	}
	return types, nil
}

// GetParts implements GetParts.
func (s *SQLiteStore) GetParts(ctx context.Context, opts ...tableland.GetPartsOption) ([]tableland.Part, error) {
	c := &tableland.GetPartsConfig{}
	for _, opt := range opts {
		opt(c)
	}

	ss := common.SQLForGettingParts(c)
	rows, err := s.db.QueryContext(ctx, ss)
	if err != nil {
		return nil, fmt.Errorf("querying for parts: %v", err)
	}

	var parts []tableland.Part
	for rows.Next() {
		var part tableland.Part
		if err := rows.Scan(&part.Fleet, &part.Original, &part.Type, &part.Name, &part.Color); err != nil {
			return nil, fmt.Errorf("scanning row into part: %v", err)
		}
		parts = append(parts, part)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("processing parts query results: %v", err)
	}
	return parts, nil
}

// GetLayers implements GetLayers.
func (s *SQLiteStore) GetLayers(ctx context.Context, fleet string, parts ...string) ([]tableland.Layer, error) {
	rows, err := s.db.QueryContext(ctx, common.SQLForGettingLayers(fleet, parts))
	if err != nil {
		return nil, fmt.Errorf("querying for layers: %v", err)
	}

	var layers []tableland.Layer
	for rows.Next() {
		var layer tableland.Layer
		if err := rows.Scan(&layer.Fleet, &layer.Part, &layer.Position, &layer.Path); err != nil {
			return nil, fmt.Errorf("scanning row into layer: %v", err)
		}
		layers = append(layers, layer)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("processing parts query results: %v", err)
	}
	return layers, nil
}

// Close implements io.Closer.
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}
