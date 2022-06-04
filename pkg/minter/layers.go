package minter

import (
	"context"
	"fmt"
	"image"
	"sync"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
)

// Layers provides access to the NFT layer images.
type Layers struct {
	ipfs  iface.CoreAPI
	cache map[string]image.Image
	lck   sync.Mutex
}

// NewLayers creates a new Layers.
func NewLayers(ipfs iface.CoreAPI) *Layers {
	return &Layers{
		ipfs:  ipfs,
		cache: make(map[string]image.Image),
	}
}

// GetLayer returns a layer image for the provided path.
func (l *Layers) GetLayer(ctx context.Context, path string) (image.Image, error) {
	l.lck.Lock()
	defer l.lck.Unlock()

	if image, ok := l.cache[path]; ok {
		return image, nil
	}

	p := ipfspath.New(path)
	n, err := l.ipfs.Unixfs().Get(ctx, p)
	if err != nil {
		return nil, fmt.Errorf("getting ipfs node for path: %v", err)
	}
	file := ipfsfiles.ToFile(n)
	if file == nil {
		return nil, fmt.Errorf("node is a directory")
	}
	i, _, err := image.Decode(file)
	if err != nil {
		return nil, fmt.Errorf("decoding image: %v", err)
	}
	l.cache[path] = i
	return i, nil
}
