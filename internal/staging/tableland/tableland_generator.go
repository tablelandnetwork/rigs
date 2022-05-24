package tableland

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image/png"
	"io"
	"math/rand"
	"os"
	"path"
	"runtime"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/minter"
	"github.com/tablelandnetwork/nft-minter/minter/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer"
)

// TablelandGenerator generates NFT metadata from traits defined in parts.db.
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
		rig, dist, mindist, maxdist, err := g.m.Mint(ctx, i, system.NewSystemRandomnessSource())
		if err != nil {
			return nil, fmt.Errorf("minting: %v", err)
		}

		var rarity float64 = 1
		if maxdist != 0 && maxdist > mindist {
			rarity = (dist - mindist) / (maxdist - mindist) // scale to range 0-1
		}

		md = append(md, staging.GeneratedMetadata{
			Metadata: rigToMetadata(rig),
			Rarity:   staging.Rarity(rarity * 100),
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
	defer func() {
		logMemUsage()
	}()

	g.limiter <- struct{}{}
	defer func() { <-g.limiter }()

	log.Debug().
		Bool("reload layers", reloadLayers).
		Msg("rendering image")

	layers, err := g.getLayers(ctx, md)
	if err != nil {
		return fmt.Errorf("getting layers: %v", err)
	}

	var label string
	if drawLabels {
		label, err = getTraitsLabel(md)
		if err != nil {
			return fmt.Errorf("getting traits label: %v", err)
		}
	}

	r, err := renderer.NewRenderer(width, height, drawLabels, label)
	if err != nil {
		return fmt.Errorf("building renderer: %v", err)
	}
	defer r.Dispose()

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("getting home dir: %v", err)
	}

	for _, l := range layers {
		// TODO: Check in memory cache for staging.Image

		log.Debug().
			Str("name", l.Part).
			Msg("adding layer")

		label := fmt.Sprintf("%d: %s: %s", l.Position, l.Part, l.Path)
		if err := r.AddLayerByFile(path.Join(home, "Dropbox/Tableland/NFT/Fleets", l.Path), label); err != nil {
			// if err := r.AddLayerByFile(path.Join(home, "tmp", l.Path), label); err != nil {
			return fmt.Errorf("adding layer: %v", err)
		}
	}

	return r.Write(writer, compression)
}

func (g *TablelandGenerator) getLayers(ctx context.Context, md staging.Metadata) ([]store.Layer, error) {
	fleet, err := getFleet(md)
	if err != nil {
		return nil, err
	}

	var partValues []string
	for _, att := range md.Attributes {
		if val, ok := att.Value.(string); ok {
			partValues = append(partValues, val)
		}
	}
	return g.s.GetLayers(ctx, fleet, partValues...)
}

func getFleet(md staging.Metadata) (string, error) {
	for _, trait := range md.Attributes {
		if trait.TraitType == "Fleet" {
			return trait.Value.(string), nil
		}
	}
	return "", errors.New("no Fleet attribute found")
}

func getTraitsLabel(md staging.Metadata) (string, error) {
	b, err := json.MarshalIndent(md, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Close implements io.Closer.
func (g *TablelandGenerator) Close() error {
	return nil
}

func logMemUsage() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	log.Debug().
		Str("alloc", fmt.Sprintf("%v", bToMb(m.Alloc))).
		Str("total", fmt.Sprintf("%v", bToMb(m.TotalAlloc))).
		Str("sys", fmt.Sprintf("%v", bToMb(m.Sys))).
		Str("gc", fmt.Sprintf("%v", m.NumGC)).
		Msg("memstats")
}

func bToMb(b uint64) uint64 {
	return b / 1024 / 1024
}
