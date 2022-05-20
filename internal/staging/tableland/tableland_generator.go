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
	"path"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer"
)

// TablelandGenerator generates NFT metadata from traits defined in parts.db.
type TablelandGenerator struct {
	s        store.Store
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

		var vehicleParts []store.Part
		for _, ptd := range partTypeDistributions {
			parts, err := g.s.GetParts(ctx, store.OfFleet(ptd.Fleet.String), store.OfType(ptd.PartType), store.OrderBy("rank"))
			if err != nil {
				return nil, fmt.Errorf("getting parts for fleet: %v", err)
			}

			part, d, min, max, err := selectPart(&m, parts, ptd.Distribution)
			if err != nil {
				return nil, fmt.Errorf("selecting part %s: %v", ptd.PartType, err)
			}
			dist += d
			mindist += min
			maxdist += max
			if part.Type != "Background" {
				vehicleParts = append(vehicleParts, part)
			}
		}

		percentOriginal := percentOriginal(vehicleParts)
		if percentOriginal == 1 {
			m.Attributes = append(
				[]staging.Trait{
					{
						TraitType: "Name",
						Value:     vehicleParts[0].Original.String,
					},
					{
						TraitType: "Color",
						Value:     vehicleParts[0].Color.String,
					},
				},
				m.Attributes...,
			)
		}

		m.Attributes = append(
			[]staging.Trait{{
				DisplayType: "number",
				TraitType:   "Original",
				Value:       percentOriginal * 100,
			}},
			m.Attributes...,
		)

		// TODO: Move this rarity to be a attributes trait.
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
			b := new(strings.Builder)
			if o.part.Color.Valid {
				b.WriteString(fmt.Sprintf("%s ", o.part.Color.String))
			}
			b.WriteString(o.part.Name)
			md.Attributes = append(md.Attributes, staging.Trait{
				TraitType: o.part.Type,
				Value:     b.String(),
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

func percentOriginal(parts []store.Part) float64 {
	counts := make(map[string]int)
	total := 0
	for _, part := range parts {
		key := fmt.Sprintf("%s|%s", part.Color.String, part.Original.String)
		if _, exists := counts[key]; !exists {
			counts[key] = 0
		}
		counts[key]++
		total++
	}
	max := 0
	for _, count := range counts {
		if count > max {
			max = count
		}
	}
	return float64(max) / float64(total)
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

	// layers, err := getLayers(md, g.layers)
	// if err != nil {
	// 	return fmt.Errorf("getting layers: %v", err)
	// }
	layers, err := g.getLayers(ctx, md)
	if err != nil {
		return fmt.Errorf("getting layers: %v", err)
	}

	var label string
	if drawLabels {
		label = getTraitsLabel(md)
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

		label := fmt.Sprintf("%s: %s", l.Part, l.Path)
		if err := r.AddLayerByFile(path.Join(home, "tmp", l.Path), label); err != nil {
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

func getTraitsLabel(md staging.Metadata) string {
	var label []string
	for _, a := range md.Attributes {
		label = append(label, fmt.Sprintf("%v", a.Value))
	}
	return strings.Join(label, ", ")
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
