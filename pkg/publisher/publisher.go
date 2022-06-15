package publisher

import (
	"context"
	"fmt"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"

	"github.com/textileio/go-tableland/pkg/client"
	"github.com/textileio/go-tableland/pkg/wallet"
)

// Publisher publishes Rig data to Tableland and IPFS.
type Publisher struct {
	client *client.Client
}

// Config holds dependencies for Publisher.
type Config struct {
	TblAPIURL    string
	EthBackend   bind.ContractBackend
	ChainID      client.ChainID
	ContractAddr common.Address
	Wallet       *wallet.Wallet
}

// NewPublisher creates a new Publisher.
func NewPublisher(ctx context.Context, config Config) (*Publisher, error) {
	client, err := client.NewClient(ctx, client.Config{
		ContractAddr: config.ContractAddr,
		TblAPIURL:    config.TblAPIURL,
		EthBackend:   config.EthBackend,
		ChainID:      config.ChainID,
		Wallet:       config.Wallet,
	})
	if err != nil {
		return nil, fmt.Errorf("creating tbl client: %v", err)
	}
	return &Publisher{
		client: client,
	}, nil
}
