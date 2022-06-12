package tableland

import (
	"context"
	"errors"
	"fmt"
	"image/png"
	"io"
	"math/rand"
	"os"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

// TablelandGenerator generates NFT metadata from traits defined in local.db.
type TablelandGenerator struct {
	s        *local.Store
	m        *builder.Builder
	rigCache map[int]local.Rig
	cacheDir string
	images   map[string]*staging.Image
	limiter  chan struct{}
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

// NewTablelandGenerator returns a new SQLiteGenerator.
func NewTablelandGenerator(
	s *local.Store,
	m *builder.Builder,
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
		rigCache: make(map[int]local.Rig),
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
		rig, err := g.m.BuildRigData(ctx, builder.RandomRigData(i, system.NewSystemRandomnessSource()))
		if err != nil {
			return nil, fmt.Errorf("minting: %v", err)
		}

		md = append(md, staging.GeneratedMetadata{
			Metadata: rigToMetadata(rig),
		})
		g.rigCache[rig.ID] = rig
	}
	return md, nil
}

func rigToMetadata(rig local.Rig) staging.Metadata {
	m := staging.Metadata{ID: rig.ID}
	if rig.Original {
		m.Attributes = append(
			m.Attributes,
			staging.Trait{
				DisplayType: "string",
				TraitType:   "Name",
				Value:       rig.Parts[0].Original,
			},
			staging.Trait{
				DisplayType: "string",
				TraitType:   "Color",
				Value:       rig.Parts[0].Color,
			},
		)
	}
	m.Attributes = append(m.Attributes, staging.Trait{
		DisplayType: "number",
		TraitType:   "Percent Original",
		Value:       rig.PercentOriginal,
	})
	for _, part := range rig.Parts {
		m.Attributes = append(m.Attributes, staging.Trait{
			DisplayType: "string",
			TraitType:   part.Type,
			Value:       part.Name,
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

	rig, ok := g.rigCache[md.ID]
	if !ok {
		return fmt.Errorf("no rig cached for id %d", md.ID)
	}

	return g.m.BuildRigImage(ctx, rig, width, height, compression, drawLabels, writer)
}

// Close implements io.Closer.
func (g *TablelandGenerator) Close() error {
	return nil
}
