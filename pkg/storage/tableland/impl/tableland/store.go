package tableland

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland/common"
	"github.com/textileio/go-tableland/pkg/client"
)

const dialect = "postgres"

// Store implements Store using the Tableland client.
type Store struct {
	tblClient              *client.Client
	receiptTimeout         time.Duration
	partsTableName         string
	layersTableName        string
	rigsTableName          string
	rigAttributesTableName string
	factory                *common.SQLFactory
}

// Config confitures a new Store.
type Config struct {
	TblClient              *client.Client
	ReceiptTimeout         time.Duration
	PartsTableName         string
	LayersTableName        string
	RigsTableName          string
	RigAttributesTableName string
}

// NewStore creates a new Store.
func NewStore(c Config) tableland.Store {
	return &Store{
		tblClient:              c.TblClient,
		receiptTimeout:         c.ReceiptTimeout,
		partsTableName:         c.PartsTableName,
		layersTableName:        c.LayersTableName,
		rigsTableName:          c.RigsTableName,
		rigAttributesTableName: c.RigAttributesTableName,
		factory:                common.NewSQLFactory(goqu.Dialect(dialect)),
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
	return tableName, nil
}

// InsertParts implements InsertParts.
func (s *Store) InsertParts(ctx context.Context, parts []local.Part) error {
	sql, err := s.factory.SQLForInsertingParts(s.partsTableName, parts)
	if err != nil {
		return fmt.Errorf("getting sql to insert parts: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// InsertLayers implements InsertLayers.
func (s *Store) InsertLayers(ctx context.Context, layers []local.Layer) error {
	sql, err := s.factory.SQLForInsertingLayers(s.layersTableName, layers)
	if err != nil {
		return fmt.Errorf("getting sql to insert layers: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// InsertRigs implements InsertRigs.
func (s *Store) InsertRigs(ctx context.Context, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingRigs(s.rigsTableName, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert rigs: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// InsertRigAttributes implements InsertRigAttributes.
func (s *Store) InsertRigAttributes(ctx context.Context, rigs []local.Rig) error {
	sql, err := s.factory.SQLForInsertingRigAttributes(s.rigAttributesTableName, rigs)
	if err != nil {
		return fmt.Errorf("getting sql to insert rig attributes: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearPartsData implements ClearPartsData.
func (s *Store) ClearPartsData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(s.partsTableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing parts data: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearLayersData implements ClearLayersData.
func (s *Store) ClearLayersData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(s.layersTableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing layers data: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearRigsData implements ClearRigsData.
func (s *Store) ClearRigsData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(s.rigsTableName)
	if err != nil {
		return fmt.Errorf("getting sql for clearing rigs data: %v", err)
	}
	return s.writeSQL(ctx, sql)
}

// ClearRigAttributesData implements ClearRigAttributesData.
func (s *Store) ClearRigAttributesData(ctx context.Context) error {
	sql, err := s.factory.SQLForClearingData(s.rigAttributesTableName)
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
		return fmt.Errorf("getting receipt: %v", err)
	}
	if !found {
		return errors.New("timed out before getting receipt")
	}
	if receipt.Error != nil {
		return fmt.Errorf("error processing txn: %s", *receipt.Error)
	}
	return nil
}
