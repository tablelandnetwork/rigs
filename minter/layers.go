package minter

import (
	"context"
	"fmt"
	"image"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
)

type Layers struct {
	ipfs iface.CoreAPI
}

func NewLayers(ipfs iface.CoreAPI, cacheDir string) (*Layers, error) {
	return &Layers{}, nil
}

func (l *Layers) GetImage(ctx context.Context, path string) (image.Image, error) {
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
	return i, nil
}
