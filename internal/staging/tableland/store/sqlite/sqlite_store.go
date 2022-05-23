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
	if _, err := s.db.Exec(common.CreateDistributionsTableSQL); err != nil {
		return fmt.Errorf("creating distributions table: %v", err)
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
func (s *SQLiteStore) InsertParts(ctx context.Context, parts []store.Part) error {
	if _, err := s.db.ExecContext(ctx, common.SQLForInsertingParts(parts)); err != nil {
		return fmt.Errorf("inserting parts: %v", err)
	}
	return nil
}

// InsertLayers implements InsertLayers.
func (s *SQLiteStore) InsertLayers(ctx context.Context, layers []store.Layer) error {
	if _, err := s.db.ExecContext(ctx, common.SQLForInsertingLayers(layers)); err != nil {
		return fmt.Errorf("inserting layers: %v", err)
	}
	return nil
}

// InsertDistributions implements InsertDistributions.
func (s *SQLiteStore) InsertDistributions(ctx context.Context, distributions []store.Distribution) error {
	if _, err := s.db.ExecContext(ctx, common.SQLForInsertingDistributions(distributions)); err != nil {
		return fmt.Errorf("inserting distributions: %v", err)
	}
	return nil
}

func (s *SQLiteStore) InsertRig(ctx context.Context, rig store.Rig) error {
	if _, err := s.db.ExecContext(ctx, common.SQLForInsertingRig(rig)); err != nil {
		return fmt.Errorf("inserting rig: %v", err)
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

func (s *SQLiteStore) GetPartTypeDistributionForFleets(ctx context.Context) (string, error) {
	var dist string
	if err := s.db.QueryRowContext(ctx, common.SQLForGettingPartTypeDistributionForFleets()).Scan(&dist); err != nil {
		return "", fmt.Errorf("querying for fleets distribution: %v", err)
	}
	return dist, nil
}

func (s *SQLiteStore) GetPartTypeDistributionsByFleet(ctx context.Context, fleet string) ([]store.Distribution, error) {
	rows, err := s.db.QueryContext(ctx, common.SQLForGettingPartTypeDistributionsByFleet(fleet))
	if err != nil {
		return nil, fmt.Errorf("querying for distributions: %v", err)
	}

	var dists []store.Distribution
	for rows.Next() {
		var d store.Distribution
		if err := rows.Scan(&d.Fleet, &d.PartType, &d.Distribution); err != nil {
			return nil, fmt.Errorf("scanning row into Distribution: %v", err)
		}
		dists = append(dists, d)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("processing distributions query results: %v", err)
	}
	return dists, nil
}

func (s *SQLiteStore) GetParts(ctx context.Context, opts ...store.GetPartsOption) ([]store.Part, error) {
	o := &store.GetPartsOptions{}
	for _, opt := range opts {
		opt(o)
	}

	ss := common.SQLForGettingParts(o)
	rows, err := s.db.QueryContext(ctx, ss)
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

func (s *SQLiteStore) GetLayers(ctx context.Context, fleet string, parts ...string) ([]store.Layer, error) {
	rows, err := s.db.QueryContext(ctx, common.SQLForGettingLayers(fleet, parts))
	if err != nil {
		return nil, fmt.Errorf("querying for layers: %v", err)
	}

	var layers []store.Layer
	for rows.Next() {
		var layer store.Layer
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
