package tableland

import (
	"context"
	"errors"
	"fmt"
	"image/png"
	"io"
	"math/rand"
	"os"
	"sort"
	"sync"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
)

// TablelandGenerator generates NFT metadata from traits defined in parts.db.
type TablelandGenerator struct {
	s        store.Store
	cacheDir string
	images   map[string]*staging.Image
	lk       sync.Mutex
	limiter  chan struct{}
}

// NewTablelandGenerator returns a new SQLiteGenerator.
func NewTablelandGenerator(
	s store.Store,
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
		cacheDir: cacheDir,
		images:   make(map[string]*staging.Image),
		limiter:  make(chan struct{}, concurrency),
	}, nil
}

func (g *TablelandGenerator) GenerateMetadata(
	ctx context.Context,
	count int,
	reloadSheets bool,
) ([]staging.GeneratedMetadata, error) {
	log.Debug().
		Int("count", count).
		Bool("reload sheets", reloadSheets).
		Msg("generating metadata")

	fleets, err := g.s.GetParts(ctx, store.OfType("Fleet"))
	if err != nil {
		return nil, fmt.Errorf("getting parts of fleet type: %v", err)
	}

	var md []staging.GeneratedMetadata
	for i := 0; i < count; i++ {
		var m staging.Metadata
		var dist, mindist, maxdist, rarity float64

		// TODO: Query for fleet type distribution to pass into selectPart

		fleetPart, d, min, max, err := selectPart(&m, fleets, "lin")
		if err != nil {
			return nil, fmt.Errorf("selecting fleet trait: %v", err)
		}
		dist += d
		mindist += min
		maxdist += max

		partTypeDistributions, err := g.s.GetPartTypeDistributionsByFleet(ctx, fleetPart.Name)
		if err != nil {
			return nil, fmt.Errorf("getting part type distributions by fleet: %v", err)
		}

		for _, s := range partTypeDistributions {
			parts, err := g.s.GetParts(ctx, store.OfFleet(s.Fleet.String), store.OfType(s.PartType))
			if err != nil {
				return nil, fmt.Errorf("getting parts for fleet: %v", err)
			}

			_, d, min, max, err := selectPart(&m, parts, s.Distribution)
			if err != nil {
				return nil, fmt.Errorf("selecting part %s: %v", s.PartType, err)
			}
			dist += d
			mindist += min
			maxdist += max
		}
		if maxdist != 0 {
			rarity = (dist - mindist) / (maxdist - mindist) // scale to range 0-1
		}
		md = append(md, staging.GeneratedMetadata{
			Metadata: m,
			Rarity:   staging.Rarity(rarity * 100),
		})
	}
	return md, nil
}

type opt struct {
	dist float64
	part store.Part
}

func selectPart(md *staging.Metadata, parts []store.Part, distribution string) (store.Part, float64, float64, float64, error) {
	var opts []opt

	if len(parts) == 0 {
		return store.Part{}, 0, 0, 0, errors.New("no parts provided to select from")
	}

	// TODO: calculate all dists from ranks and dist
	df := 1 / float64(len(parts))

	for _, part := range parts {
		opts = append(opts, opt{dist: df, part: part})
	}

	sort.SliceStable(opts, func(i, j int) bool {
		return opts[i].dist < opts[j].dist
	})

	var (
		upper float64
		lower float64
		dist  float64
		num   = rand.Float64()
		part  store.Part
	)
	for _, o := range opts {
		upper += o.dist
		if num < upper && num >= lower {
			dist = o.dist
			part = o.part
			md.Attributes = append(md.Attributes, staging.Trait{
				TraitType: o.part.Type,
				Value:     o.part.Name,
			})
			// TODO: break?
		}
		lower = upper
	}

	if dist == 0 {
		return store.Part{}, 0, 0, 0, errors.New("invalid distributions for trait")
	}

	return part, dist, opts[0].dist, opts[len(opts)-1].dist, nil
}

// RenderImage returns an image based on the given metadata.
func (g *TablelandGenerator) RenderImage(
	_ context.Context,
	md staging.Metadata,
	seeds []float64,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	reloadLayers bool,
	writer io.Writer,
) error {
	return nil

}

// Close implements io.Closer.
func (g *TablelandGenerator) Close() error {
	return nil
}
