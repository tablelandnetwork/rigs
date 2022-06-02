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
	"strings"
	"sync"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	"github.com/ipfs/interface-go-ipfs-core/options"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer"
)

const (
	fleetPartTypename      = "Fleet"
	backgroundPartTypeName = "Background"
	riderPartTypename      = "Rider"
)

// RandomnessSource defines the API for a source of random numbers.
type RandomnessSource interface {
	// GenRandoms returns n random numbers.
	GenRandoms(int) ([]float64, error)
}

// Minter mints a Rig NFT.
type Minter struct {
	s          store.Store
	layers     *Layers
	ipfs       iface.CoreAPI
	remoteIpfs iface.CoreAPI

	ipfsGatewayURL string

	fleetsCache     []store.Part
	fleetsCacheLock sync.Mutex

	fleetPartTypesCache     map[string][]string
	fleetPartTypesCacheLock sync.Mutex

	fleetPartTypePartsCache     map[string]map[string][]store.Part
	fleetPartTypePartsCacheLock sync.Mutex

	limiter chan struct{}
}

// NewMinter creates a Minter.
func NewMinter(
	s store.Store,
	concurrency int,
	ipfs iface.CoreAPI,
	remoteIpfs iface.CoreAPI,
	ipfsGatewayURL string,
) *Minter {
	return &Minter{
		s:              s,
		layers:         NewLayers(ipfs),
		ipfs:           ipfs,
		remoteIpfs:     remoteIpfs,
		ipfsGatewayURL: ipfsGatewayURL,
		limiter:        make(chan struct{}, concurrency),
	}
}

// OrignalTarget describes an original rig to be minted.
type OrignalTarget struct {
	ID       int
	Original store.OriginalRig
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
	pinLocal,
	pinRemote bool,
	opts ...Option,
) ([]store.Rig, error) {
	c := config{}
	for _, opt := range opts {
		opt(&c)
	}

	var rigs []store.Rig
	var paths []ipfspath.Path

	processRig := func(rig store.Rig) (store.Rig, ipfspath.Path, error) {
		reader, writer := io.Pipe()
		defer func() {
			if err := reader.Close(); err != nil {
				log.Error().Err(err).Msg("closing reader")
			}
		}()

		var buf bytes.Buffer
		tee := io.TeeReader(reader, &buf)

		go func() {
			m.MintRigImage(ctx, rig, width, height, compression, drawLabels, writer)
			writer.Close()
		}()

		path, err := m.ipfs.Unixfs().Add(
			ctx,
			ipfsfiles.NewReaderFile(tee),
			options.Unixfs.Pin(pinLocal),
			options.Unixfs.CidVersion(1),
		)
		if err != nil {
			return store.Rig{}, nil, fmt.Errorf("adding image to ipfs: %v", err)
		}

		if pinRemote {
			_, err := m.remoteIpfs.Unixfs().Add(
				ctx,
				ipfsfiles.NewReaderFile(&buf),
				options.Unixfs.Pin(pinRemote),
				options.Unixfs.CidVersion(1),
			)
			if err != nil {
				return store.Rig{}, nil, fmt.Errorf("adding image to remote ipfs: %v", err)
			}
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
		m.unpinPaths(ctx, paths, pinLocal, pinRemote)
		return nil, fmt.Errorf("inserting rigs: %v", err)
	}

	return rigs, nil
}

func (m *Minter) unpinPaths(ctx context.Context, paths []ipfspath.Path, local, remote bool) {
	for _, path := range paths {
		if local {
			if err := m.ipfs.Pin().Rm(ctx, path); err != nil {
				log.Error().Err(err).Msg("unpinning from local ipfs")
			}
		}
		if remote {
			if err := m.remoteIpfs.Pin().Rm(ctx, path); err != nil {
				log.Error().Err(err).Msg("unpinning from remote ipfs")
			}
		}
	}
}

type rigDataConfig struct {
	id          int
	randomness  RandomnessSource
	originalRig store.OriginalRig
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
func OriginalRigData(ID int, randomnessSource RandomnessSource, originalRig store.OriginalRig) RigDataOption {
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
) (store.Rig, error) {
	c := rigDataConfig{}
	for _, opt := range opts {
		opt(&c)
	}

	var rig store.Rig
	var parts []store.Part
	var err error

	if c.originalRig.Name == "" {
		rig, parts, err = m.mintRandomRigData(ctx, c.id, c.randomness)
	} else if c.originalRig.Name != "" {
		rig, parts, err = m.mintOriginalRigData(ctx, c.id, c.randomness, c.originalRig)
	} else {
		return store.Rig{}, errors.New("no RigDataOption provided")
	}
	if err != nil {
		return store.Rig{}, fmt.Errorf("minting rig data: %v", err)
	}

	percentOriginal, color, original := percentOriginal(parts)

	rig.Attributes = append(
		[]store.RigAttribute{{
			DisplayType: "number",
			TraitType:   "Percent Original",
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
					Value:       original,
				},
				{
					DisplayType: "string",
					TraitType:   "Color",
					Value:       color,
				},
			},
			rig.Attributes...,
		)
	}
	return rig, nil
}

func (m *Minter) mintRandomRigData(
	ctx context.Context,
	ID int,
	rs RandomnessSource,
) (store.Rig, []store.Part, error) {
	rig := store.Rig{ID: ID}

	fleets, err := m.fleets(ctx)
	if err != nil {
		return store.Rig{}, nil, fmt.Errorf("getting fleets: %v", err)
	}

	randoms, err := rs.GenRandoms(10)
	if err != nil {
		return store.Rig{}, nil, fmt.Errorf("getting random numbers: %v", err)
	}

	fleetPart, err := selectPart(fleets, randoms[0])
	if err != nil {
		return store.Rig{}, nil, fmt.Errorf("selecting fleet trait: %v", err)
	}
	applyPartToRig(&rig, fleetPart)

	partTypes, err := m.fleetPartTypes(ctx, fleetPart.Name)
	if err != nil {
		return store.Rig{}, nil, fmt.Errorf("getting fleet part types: %v", err)
	}

	if len(partTypes) > len(randoms)-1 {
		return store.Rig{}, nil, errors.New("more part types than random numbers")
	}

	var selectedParts []store.Part
	for i, partType := range partTypes {
		parts, err := m.fleetPartTypeParts(
			ctx,
			fleetPart.Name,
			partType,
		)
		if err != nil {
			return store.Rig{}, nil, fmt.Errorf("getting parts for fleet and part type: %v", err)
		}

		part, err := selectPart(parts, randoms[i+1])
		if err != nil {
			return store.Rig{}, nil, fmt.Errorf("selecting part %s: %v", partType, err)
		}
		applyPartToRig(&rig, part)

		selectedParts = append(selectedParts, part)
	}

	return rig, selectedParts, nil
}

func (m *Minter) mintOriginalRigData(
	ctx context.Context,
	id int,
	rs RandomnessSource,
	original store.OriginalRig,
) (store.Rig, []store.Part, error) {
	rig := store.Rig{ID: id}

	fleetParts, err := m.s.GetParts(ctx, store.OfType("Fleet"), store.OfName(original.Fleet))
	if err != nil {
		return store.Rig{}, nil, fmt.Errorf("getting fleet part: %v", err)
	}
	if len(fleetParts) != 1 {
		return store.Rig{}, nil, fmt.Errorf("should have found 1 fleet part, but found %d", len(fleetParts))
	}

	fleetPart := fleetParts[0]

	applyPartToRig(&rig, fleetPart)

	partTypes, err := m.fleetPartTypes(ctx, fleetPart.Name)
	if err != nil {
		return store.Rig{}, nil, fmt.Errorf("getting fleet part types: %v", err)
	}

	randomVals, err := rs.GenRandoms(10)
	if err != nil {
		return store.Rig{}, nil, fmt.Errorf("generating random numbers part type seleciton: %v", err)
	}
	var selectedParts []store.Part
	for i, partType := range partTypes {
		var options []store.GetPartsOption
		if partType == backgroundPartTypeName {
			options = []store.GetPartsOption{
				store.OfFleet(fleetPart.Name),
				store.OfType(partType),
			}
		} else if partType == riderPartTypename {
			options = []store.GetPartsOption{
				store.OfFleet(fleetPart.Name),
				store.OfType(partType),
				// store.OfColor(original.Color), // TODO: re-enable this.
			}
		} else {
			options = []store.GetPartsOption{
				store.OfFleet(fleetPart.Name),
				store.OfType(partType),
				store.OfColor(original.Color),
				store.OfOriginal(original.Name),
			}
		}

		parts, err := m.s.GetParts(ctx, options...)
		if err != nil {
			return store.Rig{}, nil, fmt.Errorf("getting parts for original fleet part type: %v", err)
		}

		var part store.Part
		if partType == backgroundPartTypeName || partType == riderPartTypename {
			selectedPart, err := selectPart(parts, randomVals[i])
			if err != nil {
				return store.Rig{}, nil, fmt.Errorf("selecting part: %v", err)
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
			return store.Rig{},
				nil,
				fmt.Errorf(
					"should have found 1 part for original %s, color %s, part type %s, but found %d",
					original.Name,
					original.Color,
					partType,
					len(parts),
				)
		}

		applyPartToRig(&rig, part)

		selectedParts = append(selectedParts, part)
	}
	return rig, selectedParts, nil
}

// MintRigImage writes the Rig image to the provider Writer for the provided Rig.
func (m *Minter) MintRigImage(
	ctx context.Context,
	rig store.Rig,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	writer io.Writer,
) error {
	// defer func() {
	// 	logMemUsage()
	// }()

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

		label := fmt.Sprintf("%d: %s: %s", l.Position, l.Part, l.Path)

		if err := r.AddLayer(i, label); err != nil {
			return fmt.Errorf("adding layer to renderer: %v", err)
		}
	}

	if err := r.Write(writer, compression); err != nil {
		return fmt.Errorf("writing to renderer: %v", err)
	}

	return nil
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

func selectPart(parts []store.Part, random float64) (store.Part, error) {
	var opts []opt

	if len(parts) == 0 {
		return store.Part{}, errors.New("no parts provided to select from")
	}

	var breaks []float64
	var sum float64
	for _, part := range parts {
		var category, item string
		if part.Type == fleetPartTypename {
			category = "Fleets"
			item = part.Name
		} else if part.Type == riderPartTypename {
			category = "Riders"
			item = part.Color.String
		} else if part.Type == backgroundPartTypeName {
			category = "Backgrounds"
			item = part.Color.String
		} else {
			category = part.Fleet.String
			item = part.Original.String
		}

		rank, err := GetRank(category, item)
		if err != nil {
			return store.Part{}, err
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

	return store.Part{}, errors.New("couldn't randomly select part")
}

func applyPartToRig(rig *store.Rig, part store.Part) {
	b := new(strings.Builder)
	if part.Color.Valid {
		b.WriteString(fmt.Sprintf("%s ", part.Color.String))
	}
	b.WriteString(part.Name)
	rig.Attributes = append(rig.Attributes, store.RigAttribute{
		DisplayType: "string",
		TraitType:   part.Type,
		Value:       b.String(),
	})
}

func percentOriginal(parts []store.Part) (float64, string, string) {
	// TODO: Figure out how to deal with Riders and other strange parts.
	counts := make(map[string]int)
	total := 0
	lastColor := ""
	lastOriginal := ""
	for _, part := range parts {
		if !part.Color.Valid || !part.Original.Valid {
			continue
		}
		lastColor = part.Color.String
		lastOriginal = part.Original.String
		key := fmt.Sprintf("%s|%s", lastColor, lastOriginal)
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
	return float64(max) / float64(total), lastColor, lastOriginal
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
