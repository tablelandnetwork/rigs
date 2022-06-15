package client

import (
	"context"
	"fmt"
	"time"

	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"
	"github.com/textileio/go-tableland/pkg/client"
)

// Store implements Store using the Tableland client.
type Store struct {
	tblClient      *client.Client
	receiptTimeout time.Duration
}

// NewStore creates a new Store.
func NewStore(tblClient *client.Client, receiptTimeout time.Duration) tableland.Store {
	return &Store{
		tblClient:      tblClient,
		receiptTimeout: receiptTimeout,
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
	return nil
}

// InsertLayers implements InsertLayers.
func (s *Store) InsertLayers(ctx context.Context, layers []local.Layer) error {
	return nil
}

// InsertRigs implements InsertRigs.
func (s *Store) InsertRigs(ctx context.Context, rigs []local.Rig) error {
	return nil
}

// Close implements io.Closer.
func (s *Store) Close() error {
	return nil
}
