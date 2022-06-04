package tableland

import (
	"context"
	"errors"
	"fmt"
	"image/png"
	"io"
	"math/rand"
	"os"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/minter"
	"github.com/tablelandnetwork/nft-minter/minter/randomness/system"
)

// TablelandGenerator generates NFT metadata from traits defined in inventory.db.
type TablelandGenerator struct {
	s        store.Store
	m        *minter.Minter
	cacheDir string
	images   map[string]*staging.Image
	lk       sync.Mutex
	limiter  chan struct{}
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

// NewTablelandGenerator returns a new SQLiteGenerator.
func NewTablelandGenerator(
	s store.Store,
	m *minter.Minter,
	concurrency int,
	cacheDir string,
) (*TablelandGenerator, error) {
	if concurrency < 1 {
		return nil, errors.New("concurrency must be greater than 1")
	}

	if len(cacheDir) != 0 {
		if err := os.MkdirAll(cacheDir, os.ModePerm); err != nil {
			return nil, fmt.Errorf("creating cache directory %v", err)
		}
	}

	return &TablelandGenerator{
		s:        s,
		m:        m,
		cacheDir: cacheDir,
		images:   make(map[string]*staging.Image),
		limiter:  make(chan struct{}, concurrency),
	}, nil
}

// GenerateMetadata implements GenerateMetadata.
func (g *TablelandGenerator) GenerateMetadata(
	ctx context.Context,
	count int,
	reloadSheets bool,
) ([]staging.GeneratedMetadata, error) {
	log.Debug().
		Int("count", count).
		Bool("reload sheets", reloadSheets).
		Msg("generating metadata")

	var md []staging.GeneratedMetadata
	for i := 0; i < count; i++ {
		rig, err := g.m.MintRigData(ctx, minter.RandomRigData(i, system.NewSystemRandomnessSource()))
		if err != nil {
			return nil, fmt.Errorf("minting: %v", err)
		}

		md = append(md, staging.GeneratedMetadata{
			Metadata: rigToMetadata(rig),
		})
	}
	return md, nil
}

func rigToMetadata(rig store.Rig) staging.Metadata {
	m := staging.Metadata{}
	for _, att := range rig.Attributes {
		m.Attributes = append(m.Attributes, staging.Trait{
			DisplayType: att.DisplayType,
			TraitType:   att.TraitType,
			Value:       att.Value,
		})
	}
	return m
}

// RenderImage returns an image based on the given metadata.
func (g *TablelandGenerator) RenderImage(
	ctx context.Context,
	md staging.Metadata,
	seeds []float64,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	reloadLayers bool,
	writer io.Writer,
) error {
	g.limiter <- struct{}{}
	defer func() { <-g.limiter }()

	log.Debug().
		Bool("reload layers", reloadLayers).
		Msg("rendering image")

	return g.m.MintRigImage(ctx, metadataToRig(md), width, height, compression, drawLabels, writer)
}

func metadataToRig(md staging.Metadata) store.Rig {
	rig := store.Rig{}
	for _, att := range md.Attributes {
		rig.Attributes = append(rig.Attributes, store.RigAttribute{
			DisplayType: att.DisplayType,
			TraitType:   att.TraitType,
			Value:       att.Value,
		})
	}
	return rig
}

// Close implements io.Closer.
func (g *TablelandGenerator) Close() error {
	return nil
}
