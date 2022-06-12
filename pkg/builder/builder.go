package builder

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image/png"
	"io"
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

// Builder builds Rigs.
type Builder struct {
	s      *local.Store
	layers *Layers
	ipfs   iface.CoreAPI

	ipfsGatewayURL string

	fleetsCache             []local.Part
	fleetPartTypesCache     map[string][]string
	fleetPartTypePartsCache map[string]map[string][]local.Part

	locks sync.Map
}

// NewBuilder creates a Builder.
func NewBuilder(
	s *local.Store,
	ipfs iface.CoreAPI,
	ipfsGatewayURL string,
	localLayersDir string,
) *Builder {
	return &Builder{
		s:              s,
		layers:         NewLayers(ipfs, s, localLayersDir),
		ipfs:           ipfs,
		ipfsGatewayURL: ipfsGatewayURL,
	}
}

// OrignalTarget describes an original rig to be built.
type OrignalTarget struct {
	ID       int
	Original local.OriginalRig
}
type config struct {
	id         *int
	target     *OrignalTarget
	randomness RandomnessSource
}

// Option is an item that controls the behavior of Build.
type Option func(*config)

// Random provides configuration for random rig building.
func Random(randomnessSource RandomnessSource, ID int) Option {
	return func(c *config) {
		c.id = &ID
		c.randomness = randomnessSource
	}
}

// Original provides configuration for building original rigs.
func Original(randomnessSource RandomnessSource, target OrignalTarget) Option {
	return func(c *config) {
		c.target = &target
		c.randomness = randomnessSource
	}
}

// Build creates a Rig.
func (m *Builder) Build(
	ctx context.Context,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	pin bool,
	opts ...Option,
) (*local.Rig, error) {
	c := config{}
	for _, opt := range opts {
		opt(&c)
	}
	if c.id == nil && c.target == nil {
		return nil, errors.New("must specify random or original build option")
	}
	if c.id != nil && c.target != nil {
		return nil, errors.New("must specify either random or original build option, not both")
	}

	var opt RigDataOption
	if c.id != nil {
		opt = RandomRigData(*c.id, c.randomness)
	} else {
		opt = OriginalRigData(c.target.ID, c.randomness, c.target.Original)
	}

	rig, err := m.BuildRigData(ctx, opt)
	if err != nil {
		return nil, fmt.Errorf("building rig data: %v", err)
	}

	reader, writer := io.Pipe()
	defer func() {
		if err := reader.Close(); err != nil {
			log.Error().Err(err).Msg("closing reader")
		}
	}()

	go func() {
		if err := m.BuildRigImage(ctx, rig, width, height, compression, drawLabels, writer); err != nil {
			log.Err(err).Msg("building rig image")
		}
		if err := writer.Close(); err != nil {
			log.Err(err).Msg("closing image writer")
		}
	}()

	path, err := m.ipfs.Unixfs().Add(
		ctx,
		ipfsfiles.NewReaderFile(reader),
		options.Unixfs.Pin(pin),
		options.Unixfs.CidVersion(1),
	)
	if err != nil {
		return nil, fmt.Errorf("adding image to ipfs: %v", err)
	}

	rig.Image = m.ipfsGatewayURL + path.String()

	if err := m.s.InsertRigs(ctx, []local.Rig{rig}); err != nil {
		if pin {
			m.unpinPath(ctx, path)
		}
		return nil, fmt.Errorf("inserting rigs: %v", err)
	}

	rigImage := local.RigImage{RigID: rig.ID, IpfsPath: path.String()}
	if err := m.s.InsertRigImages(ctx, []local.RigImage{rigImage}); err != nil {
		return nil, fmt.Errorf("inserting rig images: %v", err)
	}

	return &rig, nil
}

func (m *Builder) unpinPath(ctx context.Context, path ipfspath.Path) {
	if err := m.ipfs.Pin().Rm(ctx, path); err != nil {
		log.Error().Err(err).Msg("unpinning from local ipfs")
	}
}

type rigDataConfig struct {
	id          int
	randomness  RandomnessSource
	originalRig local.OriginalRig
}

// RigDataOption is an item that controls the behavior of BuildRigData.
type RigDataOption func(*rigDataConfig)

// RandomRigData provides configuration for building a random rig.
func RandomRigData(ID int, randomnessSource RandomnessSource) RigDataOption {
	return func(c *rigDataConfig) {
		c.id = ID
		c.randomness = randomnessSource
	}
}

// OriginalRigData provides configuration for building an original rig.
func OriginalRigData(ID int, randomnessSource RandomnessSource, originalRig local.OriginalRig) RigDataOption {
	return func(c *rigDataConfig) {
		c.id = ID
		c.randomness = randomnessSource
		c.originalRig = originalRig
	}
}

// BuildRigData generates a Rig.
func (m *Builder) BuildRigData(
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
		rig, err = m.buildRandomRigData(ctx, c.id, c.randomness)
	} else if c.originalRig.Name != "" {
		rig, err = m.buildOriginalRigData(ctx, c.id, c.randomness, c.originalRig)
	} else {
		return local.Rig{}, errors.New("no RigDataOption provided")
	}
	if err != nil {
		return local.Rig{}, fmt.Errorf("building rig data: %v", err)
	}

	rig.PercentOriginal = percentOriginal(rig.Parts)
	return rig, nil
}

func (m *Builder) buildRandomRigData(
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

func (m *Builder) buildOriginalRigData(
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

// BuildRigImage writes the Rig image to the provider Writer for the provided Rig.
func (m *Builder) BuildRigImage(
	ctx context.Context,
	rig local.Rig,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	writer io.Writer,
) error {
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

func (m *Builder) getLayers(ctx context.Context, rig local.Rig) ([]local.Layer, error) {
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

func (m *Builder) fleets(ctx context.Context) ([]local.Part, error) {
	value, _ := m.locks.LoadOrStore("fleets", &sync.Mutex{})
	lock := value.(*sync.Mutex)
	lock.Lock()
	defer lock.Unlock()

	if m.fleetsCache == nil || len(m.fleetsCache) == 0 {
		fleets, err := m.s.Parts(ctx, local.PartsOfType("Fleet"))
		if err != nil {
			return nil, fmt.Errorf("getting parts of fleet type: %v", err)
		}
		m.fleetsCache = fleets
	}
	return m.fleetsCache, nil
}

func (m *Builder) fleetPartTypes(ctx context.Context, fleet string) ([]string, error) {
	value, _ := m.locks.LoadOrStore(fleet, &sync.Mutex{})
	lock := value.(*sync.Mutex)
	lock.Lock()
	defer lock.Unlock()

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

func (m *Builder) fleetPartTypeParts(ctx context.Context, fleet string, partType string) ([]local.Part, error) {
	value, _ := m.locks.LoadOrStore(fleet+partType, &sync.Mutex{})
	lock := value.(*sync.Mutex)
	lock.Lock()
	defer lock.Unlock()

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
