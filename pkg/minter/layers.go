package minter

import (
	"context"
	"fmt"
	"image"
	"io"
	"os"
	"path"
	"sync"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

// Layers provides access to the NFT layer images.
type Layers struct {
	ipfs           iface.CoreAPI
	store          *local.Store
	localLayersDir string
	cache          map[string]image.Image
	lck            sync.Mutex
}

// NewLayers creates a new Layers.
func NewLayers(ipfs iface.CoreAPI, store *local.Store, localLayersDir string) *Layers {
	return &Layers{
		ipfs:           ipfs,
		store:          store,
		localLayersDir: localLayersDir,
		cache:          make(map[string]image.Image),
	}
}

// GetLayer returns a layer image for the provided path.
func (l *Layers) GetLayer(ctx context.Context, ipfsPath string) (image.Image, error) {
	l.lck.Lock()
	defer l.lck.Unlock()

	if image, ok := l.cache[ipfsPath]; ok {
		return image, nil
	}

	var r io.Reader

	if l.localLayersDir != "" {
		filePath, err := l.store.LayerPathForCid(ctx, ipfsPath)
		if err != nil {
			return nil, fmt.Errorf("getting file path for ipfs path: %v", err)
		}
		r, err = os.Open(path.Join(l.localLayersDir, filePath))
		if err != nil {
			return nil, fmt.Errorf("opening local layer file: %v", err)
		}
	} else {
		p := ipfspath.New(ipfsPath)
		n, err := l.ipfs.Unixfs().Get(ctx, p)
		if err != nil {
			return nil, fmt.Errorf("getting ipfs node for path: %v", err)
		}
		r = ipfsfiles.ToFile(n)
		if r == nil {
			return nil, fmt.Errorf("node is a directory")
		}
	}

	i, _, err := image.Decode(r)
	if err != nil {
		return nil, fmt.Errorf("decoding image: %v", err)
	}
	l.cache[ipfsPath] = i
	return i, nil
}
