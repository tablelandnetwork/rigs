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
	partsTableName         string
	layersTableName        string
	rigsTableName          string
	rigAttributesTableName string
	outPath                string
	factory                *common.SQLFactory
	lock                   sync.Mutex
	count                  int
}

// Config confitures a new Store.
type Config struct {
	PartsTableName         string
	LayersTableName        string
	RigsTableName          string
	RigAttributesTableName string
	OutPath                string
}

// NewStore creates a new Store.
func NewStore(c Config) (tableland.Store, error) {
	if err := os.MkdirAll(c.OutPath, os.ModePerm); err != nil {
		return nil, fmt.Errorf("creating files path: %v", err)
	}
	return &Store{
		partsTableName:         c.PartsTableName,
		layersTableName:        c.LayersTableName,
		rigsTableName:          c.RigsTableName,
		rigAttributesTableName: c.RigAttributesTableName,
		outPath:                c.OutPath,
		factory:                common.NewSQLFactory(goqu.Dialect(dialect)),
	}, nil
}

// CreateTable implements CreateTable.
func (s *Store) CreateTable(ctx context.Context, definition tableland.TableDefinition) (string, error) {
	return "", errors.New("CreateTable not implemented")
}

// InsertParts implements InsertParts.
func (s *Store) InsertParts(ctx context.Context, parts []local.Part) error {
	sql, err := s.factory.SQLForInsertingParts(s.partsTableName, parts)
	if err != nil {
		return fmt.Errorf("getting sql to insert parts: %v", err)
	}
	return s.writeSQL(ctx, "parts", sql)
}

// InsertLayers implements InsertLayers.
func (s *Store) InsertLayers(ctx context.Context, layers []local.Layer) error {
	sql, err := s.factory.SQLForInsertingLayers(s.layersTableName, layers)
	if err != nil {
		return fmt.Errorf("getting sql to insert layers: %v", err)
	}
	return s.writeSQL(ctx, "layers", sql)
}

// InsertRigs implements InsertRigs.
func (s *Store) InsertRigs(ctx context.Context, gateway string, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingRigs(s.rigsTableName, gateway, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert rigs: %v", err)
	}
	return s.writeSQL(ctx, "rigs", sql)
}

// InsertRigAttributes implements InsertRigAttributes.
func (s *Store) InsertRigAttributes(ctx context.Context, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingRigAttributes(s.rigAttributesTableName, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert rig attributes: %v", err)
	}
	return s.writeSQL(ctx, "rig-attributes", sql)
}

// ClearPartsData implements ClearPartsData.
func (s *Store) ClearPartsData(ctx context.Context) error {
	return errors.New("ClearPartsData not implemented")
}

// ClearLayersData implements ClearLayersData.
func (s *Store) ClearLayersData(ctx context.Context) error {
	return errors.New("ClearLayersData not implemented")
}

// ClearRigsData implements ClearRigsData.
func (s *Store) ClearRigsData(ctx context.Context) error {
	return errors.New("ClearRigsData not implemented")
}

// ClearRigAttributesData implements ClearRigAttributesData.
func (s *Store) ClearRigAttributesData(ctx context.Context) error {
	return errors.New("ClearRigAttributesData not implemented")
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return nil
}

func (s *Store) writeSQL(ctx context.Context, category, sql string) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	filename := fmt.Sprintf("%s/%02d_%s.sql", s.outPath, s.count, category)

	if err := os.WriteFile(filename, []byte(sql), 0o644); err != nil {
		return err
	}
	s.count++
	return nil
}
