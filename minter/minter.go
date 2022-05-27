package minter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image/png"
	"io"
	"sort"
	"strings"
	"sync"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer"
)

// RandomnessSource defines the API for a source of random numbers.
type RandomnessSource interface {
	// GenRandoms returns n random numbers.
	GenRandoms(int) ([]float64, error)
}

// Minter mints a Rig NFT.
type Minter struct {
	s      store.Store
	layers *Layers
	ipfs   iface.CoreAPI

	fleetsCache     []store.Part
	fleetsCacheLock sync.Mutex

	fleetPartTypesCache     map[string][]string
	fleetPartTypesCacheLock sync.Mutex

	fleetPartTypePartsCache     map[string]map[string][]store.Part
	fleetPartTypePartsCacheLock sync.Mutex

	limiter chan struct{}
}

// NewMinter creates a Minter.
func NewMinter(s store.Store, concurrency int, ipfs iface.CoreAPI) *Minter {
	return &Minter{
		s:       s,
		layers:  NewLayers(ipfs),
		ipfs:    ipfs,
		limiter: make(chan struct{}, concurrency),
	}
}

// Mint mints the Rig NFT.
func (m *Minter) Mint(
	ctx context.Context,
	ID int,
	rs RandomnessSource,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
) (store.Rig, float64, float64, float64, error) {
	m.limiter <- struct{}{}
	defer func() { <-m.limiter }()

	rig := store.Rig{ID: ID}

	fleets, err := m.fleets(ctx)
	if err != nil {
		return store.Rig{}, 0, 0, 0, fmt.Errorf("getting fleets: %v", err)
	}

	randoms, err := rs.GenRandoms(10)
	if err != nil {
		return store.Rig{}, 0, 0, 0, fmt.Errorf("getting random numbers: %v", err)
	}

	var dist, mindist, maxdist float64

	fleetPart, d, min, max, err := selectPart(&rig, fleets, randoms[0])
	if err != nil {
		return store.Rig{}, 0, 0, 0, fmt.Errorf("selecting fleet trait: %v", err)
	}

	dist += d
	mindist += min
	maxdist += max

	partTypes, err := m.fleetPartTypes(ctx, fleetPart.Name)
	if err != nil {
		return store.Rig{}, 0, 0, 0, fmt.Errorf("getting fleet part types: %v", err)
	}

	if len(partTypes) > len(randoms)-1 {
		return store.Rig{}, 0, 0, 0, errors.New("more part types than random numbers")
	}

	var vehicleParts []store.Part
	for i, partType := range partTypes {
		parts, err := m.fleetPartTypeParts(
			ctx,
			fleetPart.Name,
			partType,
		)
		if err != nil {
			return store.Rig{}, 0, 0, 0, fmt.Errorf("getting parts for fleet: %v", err)
		}

		part, d, min, max, err := selectPart(&rig, parts, randoms[i+1])
		if err != nil {
			return store.Rig{}, 0, 0, 0, fmt.Errorf("selecting part %s: %v", partType, err)
		}

		dist += d
		mindist += min
		maxdist += max

		if part.Type != "Background" {
			vehicleParts = append(vehicleParts, part)
		}
	}

	percentOriginal := percentOriginal(vehicleParts)

	rig.Attributes = append(
		[]store.RigAttribute{{
			DisplayType: "number",
			TraitType:   "Original",
			Value:       percentOriginal * 100,
		}},
		rig.Attributes...,
	)

	if percentOriginal == 1 {
		rig.Attributes = append(
			[]store.RigAttribute{
				{
					DisplayType: "string",
					TraitType:   "Name",
					Value:       vehicleParts[0].Original.String,
				},
				{
					DisplayType: "string",
					TraitType:   "Color",
					Value:       vehicleParts[0].Color.String,
				},
			},
			rig.Attributes...,
		)
	}

	layers, err := m.getLayers(ctx, rig)
	if err != nil {
		return store.Rig{}, 0, 0, 0, fmt.Errorf("getting layers for rig: %v", err)
	}

	var label string
	if drawLabels {
		label, err = getRigLabel(rig)
		if err != nil {
			return store.Rig{}, 0, 0, 0, fmt.Errorf("getting rig label: %v", err)
		}
	}

	r, err := renderer.NewRenderer(width, height, drawLabels, label)
	if err != nil {
		return store.Rig{}, 0, 0, 0, fmt.Errorf("building renderer: %v", err)
	}
	defer r.Dispose()

	for _, l := range layers {
		log.Debug().
			Str("name", l.Part).
			Msg("adding layer")

		i, err := m.layers.GetLayer(ctx, l.Path)
		if err != nil {
			return store.Rig{}, 0, 0, 0, fmt.Errorf("getting layer: %v", err)
		}

		label := fmt.Sprintf("%d: %s: %s", l.Position, l.Part, l.Path)

		if err := r.AddLayer(i, label); err != nil {
			return store.Rig{}, 0, 0, 0, fmt.Errorf("adding layer to renderer: %v", err)
		}
	}

	reader, writer := io.Pipe()
	defer func() {
		if err := reader.Close(); err != nil {
			log.Error().Err(err).Msg("closing reader")
		}
	}()

	go func() {
		if err := r.Write(writer, compression); err != nil {
			fmt.Printf("got a writer error: %v", err)
		}
		writer.Close()
	}()

	ipfsFile := ipfsfiles.NewReaderFile(reader)

	path, err := m.ipfs.Unixfs().Add(ctx, ipfsFile, options.Unixfs.Pin(true))
	if err != nil {
		return store.Rig{}, 0, 0, 0, fmt.Errorf("adding image to ipfs: %v", err)
	}

	rig.Image = path.String()

	if err := m.s.InsertRig(ctx, rig); err != nil {
		if err := m.ipfs.Pin().Rm(ctx, path); err != nil {
			log.Error().Err(err).Msg("unpinning from local ipfs after error inserting rig")
		}
		return store.Rig{}, 0, 0, 0, fmt.Errorf("inserting rig: %v", err)
	}

	// TODO: Pin remote.

	return rig, dist, min, max, nil
}

func (m *Minter) getLayers(ctx context.Context, rig store.Rig) ([]store.Layer, error) {
	fleet, err := getFleet(rig)
	if err != nil {
		return nil, err
	}

	var partValues []string
	for _, att := range rig.Attributes {
		if val, ok := att.Value.(string); ok {
			partValues = append(partValues, val)
		}
	}
	return m.s.GetLayers(ctx, fleet, partValues...)
}

func getFleet(rig store.Rig) (string, error) {
	for _, att := range rig.Attributes {
		if att.TraitType == "Fleet" {
			return att.Value.(string), nil
		}
	}
	return "", errors.New("no Fleet attribute found")
}

func getRigLabel(rig store.Rig) (string, error) {
	b, err := json.MarshalIndent(rig, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

type opt struct {
	dist float64
	part store.Part
}

func selectPart(rig *store.Rig, parts []store.Part, random float64) (store.Part, float64, float64, float64, error) {
	var opts []opt

	if len(parts) == 0 {
		return store.Part{}, 0, 0, 0, errors.New("no parts provided to select from")
	}

	var breaks []float64
	var sum float64
	for _, part := range parts {
		var category, item string
		if part.Type == "Fleet" {
			category = "Fleets"
			item = part.Name
		} else if part.Type == "Rider" {
			category = "Riders"
			item = part.Color.String
		} else if part.Type == "Background" {
			category = "Backgrounds"
			item = part.Color.String
		} else {
			category = part.Fleet.String
			item = part.Original.String
		}

		rank, err := GetRank(category, item)
		if err != nil {
			return store.Part{}, 0, 0, 0, err
		}

		fRank := float64(rank)
		breaks = append(breaks, fRank)
		sum += fRank
	}

	for i := 0; i < len(breaks); i++ {
		breaks[i] = breaks[i] / sum
	}

	for i, part := range parts {
		opts = append(opts, opt{dist: breaks[i], part: part})
	}

	sort.SliceStable(opts, func(i, j int) bool {
		if opts[i].dist != opts[j].dist {
			return opts[i].dist < opts[j].dist
		}
		if opts[i].part.Name != opts[j].part.Name {
			return opts[i].part.Name < opts[j].part.Name
		}
		return opts[i].part.Color.String < opts[j].part.Color.String
	})

	var (
		upper float64
		lower float64
		dist  float64
		part  store.Part
	)
	for _, o := range opts {
		upper += o.dist
		if random < upper && random >= lower {
			dist = o.dist
			part = o.part
			b := new(strings.Builder)
			if o.part.Color.Valid {
				b.WriteString(fmt.Sprintf("%s ", o.part.Color.String))
			}
			b.WriteString(o.part.Name)
			rig.Attributes = append(rig.Attributes, store.RigAttribute{
				DisplayType: "string",
				TraitType:   o.part.Type,
				Value:       b.String(),
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

func (m *Minter) fleets(ctx context.Context) ([]store.Part, error) {
	m.fleetsCacheLock.Lock()
	defer m.fleetsCacheLock.Unlock()

	if m.fleetsCache == nil || len(m.fleetsCache) == 0 {
		fleets, err := m.s.GetParts(ctx, store.OfType("Fleet"))
		if err != nil {
			return nil, fmt.Errorf("getting parts of fleet type: %v", err)
		}
		m.fleetsCache = fleets
	}
	return m.fleetsCache, nil
}

func (m *Minter) fleetPartTypes(ctx context.Context, fleet string) ([]string, error) {
	m.fleetPartTypesCacheLock.Lock()
	defer m.fleetPartTypesCacheLock.Unlock()

	if m.fleetPartTypesCache == nil {
		m.fleetPartTypesCache = make(map[string][]string)
	}
	if partTypes, ok := m.fleetPartTypesCache[fleet]; ok {
		return partTypes, nil
	}
	partTypes, err := m.s.GetPartTypesByFleet(ctx, fleet)
	if err != nil {
		return nil, err
	}
	m.fleetPartTypesCache[fleet] = partTypes
	return partTypes, nil
}

func (m *Minter) fleetPartTypeParts(ctx context.Context, fleet string, partType string) ([]store.Part, error) {
	m.fleetPartTypePartsCacheLock.Lock()
	defer m.fleetPartTypePartsCacheLock.Unlock()

	if m.fleetPartTypePartsCache == nil {
		m.fleetPartTypePartsCache = make(map[string]map[string][]store.Part)
	}
	if m.fleetPartTypePartsCache[fleet] == nil {
		m.fleetPartTypePartsCache[fleet] = make(map[string][]store.Part)
	}
	if parts, ok := m.fleetPartTypePartsCache[fleet][partType]; ok {
		return parts, nil
	}
	parts, err := m.s.GetParts(ctx, store.OfFleet(fleet), store.OfType(partType))
	if err != nil {
		return nil, err
	}
	m.fleetPartTypePartsCache[fleet][partType] = parts
	return parts, nil
}
