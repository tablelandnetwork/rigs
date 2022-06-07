package minter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image/png"
	"io"
	"runtime"
	"sort"
	"sync"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	"github.com/ipfs/interface-go-ipfs-core/options"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

const (
	fleetPartTypename      = "Fleet"
	backgroundPartTypeName = "Background"
)

// RandomnessSource defines the API for a source of random numbers.
type RandomnessSource interface {
	// GenRandoms returns n random numbers.
	GenRandoms(int) ([]float64, error)
}

// Minter mints a Rig NFT.
type Minter struct {
	s      *local.Store
	layers *Layers
	ipfs   iface.CoreAPI

	ipfsGatewayURL string

	fleetsCache     []local.Part
	fleetsCacheLock sync.Mutex

	fleetPartTypesCache     map[string][]string
	fleetPartTypesCacheLock sync.Mutex

	fleetPartTypePartsCache     map[string]map[string][]local.Part
	fleetPartTypePartsCacheLock sync.Mutex

	limiter chan struct{}
}

// NewMinter creates a Minter.
func NewMinter(
	s *local.Store,
	concurrency int,
	ipfs iface.CoreAPI,
	ipfsGatewayURL string,
) *Minter {
	return &Minter{
		s:              s,
		layers:         NewLayers(ipfs),
		ipfs:           ipfs,
		ipfsGatewayURL: ipfsGatewayURL,
	}
}

// OrignalTarget describes an original rig to be minted.
type OrignalTarget struct {
	ID       int
	Original local.OriginalRig
}
type config struct {
	ids        []int
	targets    []OrignalTarget
	randomness RandomnessSource
}

// Option is an item that controls the behavior of Mint.
type Option func(*config)

// Randoms provides configuration for random rig minting.
func Randoms(randomnessSource RandomnessSource, IDs ...int) Option {
	return func(c *config) {
		c.ids = IDs
		c.randomness = randomnessSource
	}
}

// Originals provides configuration for minting original rigs.
func Originals(randomnessSource RandomnessSource, targets ...OrignalTarget) Option {
	return func(c *config) {
		c.targets = targets
		c.randomness = randomnessSource
	}
}

// Mint mints the Rig NFT.
func (m *Minter) Mint(
	ctx context.Context,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	pin bool,
	opts ...Option,
) ([]local.Rig, error) {
	c := config{}
	for _, opt := range opts {
		opt(&c)
	}

	var rigs []local.Rig
	var paths []ipfspath.Path

	processRig := func(rig local.Rig) (local.Rig, ipfspath.Path, error) {
		reader, writer := io.Pipe()
		defer func() {
			if err := reader.Close(); err != nil {
				log.Error().Err(err).Msg("closing reader")
			}
		}()

		var buf bytes.Buffer
		tee := io.TeeReader(reader, &buf)

		go func() {
			if err := m.MintRigImage(ctx, rig, width, height, compression, drawLabels, writer); err != nil {
				log.Err(err).Msg("minting rig image")
			}
			if err := writer.Close(); err != nil {
				log.Err(err).Msg("closing image writer")
			}
		}()

		path, err := m.ipfs.Unixfs().Add(
			ctx,
			ipfsfiles.NewReaderFile(tee),
			options.Unixfs.Pin(pin),
			options.Unixfs.CidVersion(1),
		)
		if err != nil {
			return local.Rig{}, nil, fmt.Errorf("adding image to ipfs: %v", err)
		}

		rig.Image = m.ipfsGatewayURL + path.String()

		return rig, path, nil
	}

	for _, ID := range c.ids {
		rig, err := m.MintRigData(ctx, RandomRigData(ID, c.randomness))
		if err != nil {
			return nil, fmt.Errorf("minting random rig data: %v", err)
		}

		rig, path, err := processRig(rig)
		if err != nil {
			return nil, err
		}
		rigs = append(rigs, rig)
		paths = append(paths, path)
	}

	for _, target := range c.targets {
		rig, err := m.MintRigData(ctx, OriginalRigData(target.ID, c.randomness, target.Original))
		if err != nil {
			return nil, fmt.Errorf("minting original rig data: %v", err)
		}

		rig, path, err := processRig(rig)
		if err != nil {
			return nil, err
		}
		rigs = append(rigs, rig)
		paths = append(paths, path)
	}

	if err := m.s.InsertRigs(ctx, rigs); err != nil {
		if pin {
			m.unpinPaths(ctx, paths)
		}
		return nil, fmt.Errorf("inserting rigs: %v", err)
	}

	return rigs, nil
}

func (m *Minter) unpinPaths(ctx context.Context, paths []ipfspath.Path) {
	for _, path := range paths {
		if err := m.ipfs.Pin().Rm(ctx, path); err != nil {
			log.Error().Err(err).Msg("unpinning from local ipfs")
		}
	}
}

type rigDataConfig struct {
	id          int
	randomness  RandomnessSource
	originalRig local.OriginalRig
}

// RigDataOption is an item that controls the behavior of MintRigData.
type RigDataOption func(*rigDataConfig)

// RandomRigData provides configuration for minting a random rig.
func RandomRigData(ID int, randomnessSource RandomnessSource) RigDataOption {
	return func(c *rigDataConfig) {
		c.id = ID
		c.randomness = randomnessSource
	}
}

// OriginalRigData provides configuration for minting an original rig.
func OriginalRigData(ID int, randomnessSource RandomnessSource, originalRig local.OriginalRig) RigDataOption {
	return func(c *rigDataConfig) {
		c.id = ID
		c.randomness = randomnessSource
		c.originalRig = originalRig
	}
}

// MintRigData generates a Rig.
func (m *Minter) MintRigData(
	ctx context.Context,
	opts ...RigDataOption,
) (local.Rig, error) {
	c := rigDataConfig{}
	for _, opt := range opts {
		opt(&c)
	}

	var rig local.Rig
	var err error

	if c.originalRig.Name == "" {
		rig, err = m.mintRandomRigData(ctx, c.id, c.randomness)
	} else if c.originalRig.Name != "" {
		rig, err = m.mintOriginalRigData(ctx, c.id, c.randomness, c.originalRig)
	} else {
		return local.Rig{}, errors.New("no RigDataOption provided")
	}
	if err != nil {
		return local.Rig{}, fmt.Errorf("minting rig data: %v", err)
	}

	rig.PercentOriginal = percentOriginal(rig.Parts)
	return rig, nil
}

func (m *Minter) mintRandomRigData(
	ctx context.Context,
	ID int,
	rs RandomnessSource,
) (local.Rig, error) {
	rig := local.Rig{ID: ID}

	fleets, err := m.fleets(ctx)
	if err != nil {
		return local.Rig{}, fmt.Errorf("getting fleets: %v", err)
	}

	randoms, err := rs.GenRandoms(10)
	if err != nil {
		return local.Rig{}, fmt.Errorf("getting random numbers: %v", err)
	}

	fleetPart, err := selectPart(fleets, randoms[0])
	if err != nil {
		return local.Rig{}, fmt.Errorf("selecting fleet trait: %v", err)
	}
	rig.Parts = append(rig.Parts, fleetPart)

	partTypes, err := m.fleetPartTypes(ctx, fleetPart.Name)
	if err != nil {
		return local.Rig{}, fmt.Errorf("getting fleet part types: %v", err)
	}

	if len(partTypes) > len(randoms)-1 {
		return local.Rig{}, errors.New("more part types than random numbers")
	}

	for i, partType := range partTypes {
		parts, err := m.fleetPartTypeParts(
			ctx,
			fleetPart.Name,
			partType,
		)
		if err != nil {
			return local.Rig{}, fmt.Errorf("getting parts for fleet and part type: %v", err)
		}

		part, err := selectPart(parts, randoms[i+1])
		if err != nil {
			return local.Rig{}, fmt.Errorf("selecting part %s: %v", partType, err)
		}
		rig.Parts = append(rig.Parts, part)
	}

	return rig, nil
}

func (m *Minter) mintOriginalRigData(
	ctx context.Context,
	id int,
	rs RandomnessSource,
	original local.OriginalRig,
) (local.Rig, error) {
	rig := local.Rig{ID: id, Original: true}

	fleetParts, err := m.s.Parts(ctx, local.PartsOfType("Fleet"), local.PartsOfName(original.Fleet))
	if err != nil {
		return local.Rig{}, fmt.Errorf("getting fleet part: %v", err)
	}
	if len(fleetParts) != 1 {
		return local.Rig{}, fmt.Errorf("should have found 1 fleet part, but found %d", len(fleetParts))
	}

	fleetPart := fleetParts[0]

	rig.Parts = append(rig.Parts, fleetPart)

	partTypes, err := m.fleetPartTypes(ctx, fleetPart.Name)
	if err != nil {
		return local.Rig{}, fmt.Errorf("getting fleet part types: %v", err)
	}

	randomVals, err := rs.GenRandoms(10)
	if err != nil {
		return local.Rig{}, fmt.Errorf("generating random numbers part type seleciton: %v", err)
	}

	for i, partType := range partTypes {
		// We don't have a utility pack for Heavy Medler, skip it.
		if original.Name == "Heavy Medler" && partType == "Utility Pack" {
			continue
		}

		var options []local.PartsOption
		if partType == backgroundPartTypeName {
			options = []local.PartsOption{
				local.PartsOfFleet(fleetPart.Name),
				local.PartsOfType(partType),
			}
		} else {
			options = []local.PartsOption{
				local.PartsOfFleet(fleetPart.Name),
				local.PartsOfType(partType),
				local.PartsOfColor(original.Color),
				local.PartsOfOriginal(original.Name),
			}
		}

		parts, err := m.s.Parts(ctx, options...)
		if err != nil {
			return local.Rig{}, fmt.Errorf("getting parts for original fleet part type: %v", err)
		}

		var part local.Part
		if partType == backgroundPartTypeName {
			selectedPart, err := selectPart(parts, randomVals[i])
			if err != nil {
				return local.Rig{}, fmt.Errorf("selecting part: %v", err)
			}
			part = selectedPart
		} else if len(parts) == 1 {
			part = parts[0]
		} else {
			// log.Debug().Msgf(
			// 	"should have found 1 or more parts for original %s, color %s, part type %s, but found 0",
			// 	original.Name,
			// 	original.Color,
			// 	partType,
			// )
			return local.Rig{},
				fmt.Errorf(
					"should have found 1 part for original %s, color %s, part type %s, but found %d",
					original.Name,
					original.Color,
					partType,
					len(parts),
				)
		}

		rig.Parts = append(rig.Parts, part)
	}
	return rig, nil
}

// MintRigImage writes the Rig image to the provider Writer for the provided Rig.
func (m *Minter) MintRigImage(
	ctx context.Context,
	rig local.Rig,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	writer io.Writer,
) error {
	defer func() {
		logMemUsage()
	}()

	m.limiter <- struct{}{}
	defer func() { <-m.limiter }()

	layers, err := m.getLayers(ctx, rig)
	if err != nil {
		return fmt.Errorf("getting layers for rig: %v", err)
	}

	var label string
	if drawLabels {
		label, err = getRigLabel(rig)
		if err != nil {
			return fmt.Errorf("getting rig label: %v", err)
		}
	}

	r, err := renderer.NewRenderer(width, height, drawLabels, label)
	if err != nil {
		return fmt.Errorf("building renderer: %v", err)
	}
	defer r.Dispose()

	for _, l := range layers {
		// log.Debug().
		// 	Str("name", l.Part).
		// 	Msg("adding layer")

		i, err := m.layers.GetLayer(ctx, l.Path)
		if err != nil {
			return fmt.Errorf("getting layer: %v", err)
		}

		label := fmt.Sprintf("%d: %s: %s: %s", l.Position, l.Color, l.PartName, l.Path)

		if err := r.AddLayer(i, label); err != nil {
			return fmt.Errorf("adding layer to renderer: %v", err)
		}
	}

	if err := r.Write(writer, compression); err != nil {
		return fmt.Errorf("writing to renderer: %v", err)
	}

	return nil
}

func (m *Minter) getLayers(ctx context.Context, rig local.Rig) ([]local.Layer, error) {
	fleet, err := getFleet(rig)
	if err != nil {
		return nil, err
	}

	var nameAndColors []local.PartNameAndColor
	for _, part := range rig.Parts {
		nameAndColors = append(nameAndColors, local.PartNameAndColor{PartName: part.Name, Color: part.Color.String})
	}
	return m.s.Layers(ctx, fleet, nameAndColors...)
}

func getFleet(rig local.Rig) (string, error) {
	for _, part := range rig.Parts {
		if part.Type == "Fleet" {
			return part.Name, nil
		}
	}
	return "", errors.New("no fleet part found")
}

func getRigLabel(rig local.Rig) (string, error) {
	b, err := json.MarshalIndent(rig, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

type opt struct {
	dist float64
	part local.Part
}

func selectPart(parts []local.Part, random float64) (local.Part, error) {
	var opts []opt

	if len(parts) == 0 {
		return local.Part{}, errors.New("no parts provided to select from")
	}

	var breaks []float64
	var sum float64
	for _, part := range parts {
		var category, item string
		if part.Type == fleetPartTypename {
			category = "Fleets"
			item = part.Name
		} else if part.Type == backgroundPartTypeName {
			category = "Backgrounds"
			item = part.Color.String
		} else {
			category = part.Fleet.String
			item = part.Original.String
		}

		rank, err := GetRank(category, item)
		if err != nil {
			return local.Part{}, err
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
	)
	for _, o := range opts {
		upper += o.dist
		if random < upper && random >= lower {
			return o.part, nil
		}
		lower = upper
	}

	return local.Part{}, errors.New("couldn't randomly select part")
}

func percentOriginal(parts []local.Part) float64 {
	// TODO: Figure out how to deal with Riders and other strange parts.
	counts := make(map[string]int)
	total := 0
	for _, part := range parts {
		if !part.Color.Valid || !part.Original.Valid {
			continue
		}
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

func (m *Minter) fleets(ctx context.Context) ([]local.Part, error) {
	m.fleetsCacheLock.Lock()
	defer m.fleetsCacheLock.Unlock()

	if m.fleetsCache == nil || len(m.fleetsCache) == 0 {
		fleets, err := m.s.Parts(ctx, local.PartsOfType("Fleet"))
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

func (m *Minter) fleetPartTypeParts(ctx context.Context, fleet string, partType string) ([]local.Part, error) {
	m.fleetPartTypePartsCacheLock.Lock()
	defer m.fleetPartTypePartsCacheLock.Unlock()

	if m.fleetPartTypePartsCache == nil {
		m.fleetPartTypePartsCache = make(map[string]map[string][]local.Part)
	}
	if m.fleetPartTypePartsCache[fleet] == nil {
		m.fleetPartTypePartsCache[fleet] = make(map[string][]local.Part)
	}
	if parts, ok := m.fleetPartTypePartsCache[fleet][partType]; ok {
		return parts, nil
	}
	parts, err := m.s.Parts(ctx, local.PartsOfFleet(fleet), local.PartsOfType(partType))
	if err != nil {
		return nil, err
	}
	m.fleetPartTypePartsCache[fleet][partType] = parts
	return parts, nil
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
