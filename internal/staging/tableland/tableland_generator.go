package tableland

import (
	"context"
	"errors"
	"fmt"
	"image/png"
	"io"
	"math"
	"math/rand"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

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

	rand.Seed(time.Now().UnixNano())

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
		var dist, mindist, maxdist float64
		// TODO: Make sure rarity = 1 is not rare at all, approaching 0 is very rare.
		var rarity float64 = 1

		fleetsDist, err := g.s.GetPartTypeDistributionForFleets(ctx)
		if err != nil {
			return nil, fmt.Errorf("getting distribution for fleets: %v", err)
		}

		fleetPart, d, min, max, err := selectPart(&m, fleets, fleetsDist)
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

		for _, ptd := range partTypeDistributions {
			parts, err := g.s.GetParts(ctx, store.OfFleet(ptd.Fleet.String), store.OfType(ptd.PartType), store.OrderBy("rank"))
			if err != nil {
				return nil, fmt.Errorf("getting parts for fleet: %v", err)
			}

			_, d, min, max, err := selectPart(&m, parts, ptd.Distribution)
			if err != nil {
				return nil, fmt.Errorf("selecting part %s: %v", ptd.PartType, err)
			}
			dist += d
			mindist += min
			maxdist += max
		}
		if maxdist != 0 && maxdist > mindist {
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

func selectPart(
	md *staging.Metadata,
	parts []store.Part,
	distribution string,
) (store.Part, float64, float64, float64, error) {
	var opts []opt

	if len(parts) == 0 {
		return store.Part{}, 0, 0, 0, errors.New("no parts provided to select from")
	}

	var stepWidth int
	stepsParts := strings.Split(distribution, "st")
	if len(stepsParts) == 2 {
		numSteps, err := strconv.Atoi(stepsParts[1])
		if err != nil {
			return store.Part{}, 0, 0, 0, fmt.Errorf("parsing num steps: %v", err)
		}
		stepWidth = int(math.Ceil(float64(len(parts)) / float64(numSteps)))
	}

	breaks := make([]float64, len(parts))
	var sum float64
	for i := 0; i < len(parts); i++ {
		var val float64

		if stepWidth > 0 {
			step := i / stepWidth
			val = float64(step + 1)
		} else {
			switch distribution {
			case "lin":
				val = float64(i + 1)
			case "exp":
				val = math.Pow(float64(i+1), 2)
			case "log":
				val = math.Log(float64(i + 1))
			case "con":
				val = 1
			}
		}
		breaks[i] = val
		sum += val
	}

	for i := 0; i < len(breaks); i++ {
		breaks[i] = breaks[i] / sum
	}

	for i, part := range parts {
		opts = append(opts, opt{dist: breaks[i], part: part})
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
				// TODO: Decide how to represent original and color in metadata.
				Value: fmt.Sprintf("%s %s %s", o.part.Color.String, o.part.Original.String, o.part.Name),
			})
			break
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
