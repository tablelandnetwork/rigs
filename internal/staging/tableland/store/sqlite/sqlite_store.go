package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	_ "github.com/mattn/go-sqlite3"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/common"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbFile string) (*SQLiteStore, error) {
	_ = os.Remove(dbFile)
	db, err := sql.Open("sqlite3", dbFile)
	if err != nil {
		return nil, fmt.Errorf("opening db: %v", err)
	}

	return &SQLiteStore{
		db: db,
	}, nil
}

func (s *SQLiteStore) CreateTables(ctx context.Context) error {
	if _, err := s.db.Exec(common.CreatePartsTableSQL); err != nil {
		return fmt.Errorf("creating parts table: %v", err)
	}
	if _, err := s.db.Exec(common.CreateLayersTableSQL); err != nil {
		return fmt.Errorf("creating layers table: %v", err)
	}
	if _, err := s.db.Exec(common.CreateDistributionsTableSQL); err != nil {
		return fmt.Errorf("creating distributions table: %v", err)
	}
	return nil
}

func (s *SQLiteStore) InsertParts(ctx context.Context, parts []store.Part) error {
	if _, err := s.db.ExecContext(ctx, common.SqlForInsertingParts(parts)); err != nil {
		return fmt.Errorf("inserting parts: %v", err)
	}
	return nil
}

func (s *SQLiteStore) InsertPart(ctx context.Context, part store.Part) error {
	if _, err := s.db.ExecContext(ctx, common.SqlForInsertingPart(part)); err != nil {
		return fmt.Errorf("inserting part: %v", err)
	}
	return nil
}

func (s *SQLiteStore) InsertLayers(ctx context.Context, layers []store.Layer) error {
	if _, err := s.db.ExecContext(ctx, common.SqlForInsertingLayers(layers)); err != nil {
		return fmt.Errorf("inserting layers: %v", err)
	}
	return nil
}

func (s *SQLiteStore) InsertLayer(ctx context.Context, layer store.Layer) error {
	if _, err := s.db.ExecContext(ctx, common.SqlForInsertingLayer(layer)); err != nil {
		return fmt.Errorf("inserting layer: %v", err)
	}
	return nil
}

func (s *SQLiteStore) InsertDistributions(ctx context.Context, distributions []store.Distribution) error {
	if _, err := s.db.ExecContext(ctx, common.SqlForInsertingDistributions(distributions)); err != nil {
		return fmt.Errorf("inserting distributions: %v", err)
	}
	return nil
}

func (s *SQLiteStore) InsertDistribution(ctx context.Context, distribution store.Distribution) error {
	if _, err := s.db.ExecContext(ctx, common.SqlForInsertingDistribution(distribution)); err != nil {
		return fmt.Errorf("inserting distribution: %v", err)
	}
	return nil
}

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

func (s *SQLiteStore) GetParts(ctx context.Context, opts ...store.GetPartsOption) ([]store.Part, error) {
	o := &store.GetPartsOptions{}
	for _, opt := range opts {
		opt(o)
	}

	rows, err := s.db.QueryContext(ctx, common.SQLForGettingParts(o))
	if err != nil {
		return nil, fmt.Errorf("querying for parts: %v", err)
	}

	var parts []store.Part
	for rows.Next() {
		var part store.Part
		if err := rows.Scan(&part.Fleet, &part.Original, &part.Type, &part.Name, &part.Color, &part.Rank); err != nil {
			return nil, fmt.Errorf("scanning row into part: %v", err)
		}
		parts = append(parts, part)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("processing parts query results: %v", err)
	}
	return parts, nil
}

// Close implements io.Closer.
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}
