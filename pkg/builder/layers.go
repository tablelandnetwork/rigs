package builder

import (
	"context"
	"fmt"
	"image"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

// Layers provides access to the NFT layer images.
type Layers struct {
	ipfs  iface.CoreAPI
	store local.Store
}

// NewLayers creates a new Layers.
func NewLayers(ipfs iface.CoreAPI, store local.Store) *Layers {
	return &Layers{
		ipfs:  ipfs,
		store: store,
	}
}

// GetLayer returns a layer image for the provided path.
func (l *Layers) GetLayer(ctx context.Context, ipfsPath string) (image.Image, error) {
	p := ipfspath.New(ipfsPath)
	n, err := l.ipfs.Unixfs().Get(ctx, p)
	if err != nil {
		return nil, fmt.Errorf("getting ipfs node for path: %v", err)
	}
	r := ipfsfiles.ToFile(n)
	if r == nil {
		return nil, fmt.Errorf("node is a directory")
	}

	i, _, err := image.Decode(r)
	if err != nil {
		return nil, fmt.Errorf("decoding image: %v", err)
	}
	return i, nil
}
