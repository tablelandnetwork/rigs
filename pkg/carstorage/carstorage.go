package carstorage

import (
	"context"
	"io"
	"time"

	"github.com/filecoin-project/go-address"
	"github.com/ipfs/go-cid"
)

// Deal describes a Filecoin storage deal.
type Deal struct {
	DealID            uint64
	StorageProvider   address.Address
	Status            string
	PieceCid          cid.Cid
	DataCid           cid.Cid
	DataModelSelector string
	Activation        *time.Time
	Updated           time.Time
}

// Status describes the stored item status.
type Status struct {
	Cid     cid.Cid
	DagSize uint64
	Created time.Time
	Deals   []Deal
}

// CarStorage can store car files and check status.
type CarStorage interface {
	PutCar(context.Context, io.Reader) (cid.Cid, error)
	Status(context.Context, cid.Cid) (*Status, error)
}
