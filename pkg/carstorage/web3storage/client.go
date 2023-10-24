package web3storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/ipfs/go-cid"
	"github.com/tablelandnetwork/rigs/pkg/carstorage"
	"github.com/web3-storage/go-w3s-client"
)

// Client is an NFT.storage client.
type Client struct {
	w3sClient w3s.Client
}

// NewClient creates a new Client.
func NewClient(apiKey string) (carstorage.CarStorage, error) {
	c, err := w3s.NewClient(w3s.WithToken(apiKey))
	if err != nil {
		return nil, fmt.Errorf("creating web3.storage client: %v", err)
	}
	return &Client{
		w3sClient: c,
	}, nil
}

// PutCar uploads a car file.
func (c *Client) PutCar(ctx context.Context, payload io.Reader) (cid.Cid, error) {
	return c.w3sClient.PutCar(ctx, payload)
}

// Status implements carstorage.CarStorage.Status.
func (c *Client) Status(ctx context.Context, cid cid.Cid) (*carstorage.Status, error) {
	res, err := c.w3sClient.Status(ctx, cid)
	if err != nil {
		return nil, err
	}
	var deals []carstorage.Deal
	for _, deal := range res.Deals {
		var activation *time.Time
		if !deal.Activation.IsZero() {
			activation = &deal.Activation
		}
		deals = append(deals, carstorage.Deal{
			DealID:            deal.DealID,
			StorageProvider:   deal.StorageProvider,
			Status:            deal.Status.String(),
			PieceCid:          deal.PieceCid,
			DataCid:           deal.DataCid,
			DataModelSelector: deal.DataModelSelector,
			Activation:        activation,
			Updated:           deal.Updated,
		})
	}
	ret := &carstorage.Status{
		Cid:     res.Cid,
		DagSize: res.DagSize,
		Created: res.Created,
		Deals:   deals,
	}
	return ret, nil
}
