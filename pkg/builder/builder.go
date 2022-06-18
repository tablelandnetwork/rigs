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

var (
	defaultBuildConfig = buildConfig{
		size:        1200,
		thumbSize:   400,
		compression: png.DefaultCompression,
		drawLabels:  false,
		pin:         false,
	}
	defaultBuildImageConfig = buildImageConfig{
		size:        1200,
		drawLabels:  false,
		background:  true,
		compression: png.DefaultCompression,
	}
)

type buildConfig struct {
	size        int
	thumbSize   int
	compression png.CompressionLevel
	drawLabels  bool
	pin         bool
	id          int
	original    *local.OriginalRig
	randomness  RandomnessSource
}

// BuildOption is an item that controls the behavior of Build.
type BuildOption func(*buildConfig)

// BuildSize controls the size of the created image.
func BuildSize(size int) BuildOption {
	return func(c *buildConfig) {
		c.size = size
	}
}

// BuildThumbSize controls the size of the created thumbnail image.
func BuildThumbSize(size int) BuildOption {
	return func(c *buildConfig) {
		c.thumbSize = size
	}
}

// BuildCompression controls the compression level of the created image.
func BuildCompression(level png.CompressionLevel) BuildOption {
	return func(c *buildConfig) {
		c.compression = level
	}
}

// BuildLabels controls wheterh or not to draw labels on the created image.
func BuildLabels(drawLabels bool) BuildOption {
	return func(c *buildConfig) {
		c.drawLabels = drawLabels
	}
}

// BuildPin controls wheterh or not to pin the created image in IPFS.
func BuildPin(pin bool) BuildOption {
	return func(c *buildConfig) {
		c.pin = pin
	}
}

// BuildRandom provides configuration for random rig building.
func BuildRandom(id int, randomnessSource RandomnessSource) BuildOption {
	return func(c *buildConfig) {
		c.id = id
		c.randomness = randomnessSource
	}
}

// BuildOriginal provides configuration for building original rigs.
func BuildOriginal(id int, original local.OriginalRig, randomnessSource RandomnessSource) BuildOption {
	return func(c *buildConfig) {
		c.id = id
		c.original = &original
		c.randomness = randomnessSource
	}
}

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
) *Builder {
	return &Builder{
		s:              s,
		layers:         NewLayers(ipfs, s),
		ipfs:           ipfs,
		ipfsGatewayURL: ipfsGatewayURL,
	}
}

// Build creates a Rig.
func (m *Builder) Build(ctx context.Context, opts ...BuildOption) (*local.Rig, error) {
	c := defaultBuildConfig
	for _, opt := range opts {
		opt(&c)
	}

	var opt BuildDataOption
	if c.original != nil {
		opt = BuildOriginalData(c.id, *c.original, c.randomness)
	} else {
		opt = BuildRandomData(c.id, c.randomness)
	}

	rig, err := m.BuildData(ctx, opt)
	if err != nil {
		return nil, fmt.Errorf("building rig data: %v", err)
	}

	reader, writer := io.Pipe()
	defer func() {
		if err := reader.Close(); err != nil {
			log.Error().Err(err).Msg("closing reader")
		}
	}()

	alphaReader, alphaWriter := io.Pipe()
	defer func() {
		if err := alphaReader.Close(); err != nil {
			log.Error().Err(err).Msg("closing alpha reader")
		}
	}()

	thumbReader, thumbWriter := io.Pipe()
	defer func() {
		if err := thumbReader.Close(); err != nil {
			log.Error().Err(err).Msg("closing thumb reader")
		}
	}()

	thumbAlphaReader, thumbAlphaWriter := io.Pipe()
	defer func() {
		if err := thumbAlphaReader.Close(); err != nil {
			log.Error().Err(err).Msg("closing thumb alpha reader")
		}
	}()

	go func() {
		if err := m.BuildImage(ctx, rig, writer,
			BuildImageBackground(true),
			BuildImageCompression(c.compression),
			BuildImageLabels(c.drawLabels),
			BuildImageSize(c.size),
		); err != nil {
			log.Err(err).Msg("building image")
		}
		if err := writer.Close(); err != nil {
			log.Err(err).Msg("closing writer")
		}
	}()

	go func() {
		if err := m.BuildImage(ctx, rig, alphaWriter,
			BuildImageBackground(false),
			BuildImageCompression(c.compression),
			BuildImageLabels(c.drawLabels),
			BuildImageSize(c.size),
		); err != nil {
			log.Err(err).Msg("building image alpha")
		}
		if err := alphaWriter.Close(); err != nil {
			log.Err(err).Msg("closing alpha writer")
		}
	}()

	go func() {
		if err := m.BuildImage(ctx, rig, thumbWriter,
			BuildImageBackground(true),
			BuildImageCompression(c.compression),
			BuildImageLabels(c.drawLabels),
			BuildImageSize(c.thumbSize),
		); err != nil {
			log.Err(err).Msg("building thumb")
		}
		if err := thumbWriter.Close(); err != nil {
			log.Err(err).Msg("closing thumb writer")
		}
	}()

	go func() {
		if err := m.BuildImage(ctx, rig, thumbAlphaWriter,
			BuildImageBackground(false),
			BuildImageCompression(c.compression),
			BuildImageLabels(c.drawLabels),
			BuildImageSize(c.thumbSize),
		); err != nil {
			log.Err(err).Msg("building thumb alpha")
		}
		if err := thumbAlphaWriter.Close(); err != nil {
			log.Err(err).Msg("closing thumb alpha writer")
		}
	}()

	dir := ipfsfiles.NewMapDirectory(map[string]ipfsfiles.Node{
		"image.png":       ipfsfiles.NewReaderFile(reader),
		"image_alpha.png": ipfsfiles.NewReaderFile(alphaReader),
		"thumb.png":       ipfsfiles.NewReaderFile(thumbReader),
		"thumb_alpha.png": ipfsfiles.NewReaderFile(thumbAlphaReader),
	})

	path, err := m.ipfs.Unixfs().Add(
		ctx,
		dir,
		options.Unixfs.Pin(c.pin),
		options.Unixfs.CidVersion(1),
	)
	if err != nil {
		return nil, fmt.Errorf("adding image to ipfs: %v", err)
	}

	rig.Gateway = m.ipfsGatewayURL
	rig.Images = path.String()
	rig.Image = path.String() + "/image.png"
	rig.ImageAlpha = path.String() + "/image_alpha.png"
	rig.Thumb = path.String() + "/thumb.png"
	rig.ThumbAlpha = path.String() + "/thumb_alpha.png"

	if err := m.s.InsertRigs(ctx, []local.Rig{rig}); err != nil {
		if c.pin {
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

type buildDataConfig struct {
	id         int
	original   *local.OriginalRig
	randomness RandomnessSource
}

// BuildDataOption is an item that controls the behavior of BuildData.
type BuildDataOption func(*buildDataConfig)

// BuildRandomData provides configuration for random rig building.
func BuildRandomData(id int, randomnessSource RandomnessSource) BuildDataOption {
	return func(c *buildDataConfig) {
		c.id = id
		c.randomness = randomnessSource
	}
}

// BuildOriginalData provides configuration for building original rigs.
func BuildOriginalData(id int, original local.OriginalRig, randomnessSource RandomnessSource) BuildDataOption {
	return func(c *buildDataConfig) {
		c.id = id
		c.original = &original
		c.randomness = randomnessSource
	}
}

// BuildData generates Rig data.
func (m *Builder) BuildData(ctx context.Context, opt BuildDataOption) (local.Rig, error) {
	c := buildDataConfig{}
	opt(&c)

	var rig local.Rig
	var err error

	if c.original != nil {
		rig, err = m.buildOriginalData(ctx, c.id, *c.original, c.randomness)
	} else {
		rig, err = m.buildRandomData(ctx, c.id, c.randomness)
	}
	if err != nil {
		return local.Rig{}, fmt.Errorf("building rig data: %v", err)
	}

	rig.PercentOriginal = percentOriginal(rig.Parts)
	return rig, nil
}

func (m *Builder) buildRandomData(
	ctx context.Context,
	id int,
	rs RandomnessSource,
) (local.Rig, error) {
	rig := local.Rig{ID: id}

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

func (m *Builder) buildOriginalData(
	ctx context.Context,
	id int,
	original local.OriginalRig,
	rs RandomnessSource,
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

type buildImageConfig struct {
	drawLabels  bool
	size        int
	background  bool
	compression png.CompressionLevel
}

// BuildImageOption controls the behavior of BuildImage.
type BuildImageOption func(*buildImageConfig)

// BuildImageLabels specifies whether or not to render labels.
func BuildImageLabels(labels bool) BuildImageOption {
	return func(bic *buildImageConfig) {
		bic.drawLabels = labels
	}
}

// BuildImageSize specifies the size of the image to render.
func BuildImageSize(size int) BuildImageOption {
	return func(bic *buildImageConfig) {
		bic.size = size
	}
}

// BuildImageBackground specifies whether or not to render the background.
func BuildImageBackground(background bool) BuildImageOption {
	return func(bic *buildImageConfig) {
		bic.background = background
	}
}

// BuildImageCompression controls the compression level of the image.
func BuildImageCompression(compression png.CompressionLevel) BuildImageOption {
	return func(bic *buildImageConfig) {
		bic.compression = compression
	}
}

// BuildImage writes the Rig image to the provider Writer for the provided Rig.
func (m *Builder) BuildImage(
	ctx context.Context,
	rig local.Rig,
	writer io.Writer,
	opts ...BuildImageOption,
) error {
	c := defaultBuildImageConfig
	for _, opt := range opts {
		opt(&c)
	}

	layers, err := m.getLayers(ctx, rig, c.background)
	if err != nil {
		return fmt.Errorf("getting layers for rig: %v", err)
	}

	var label string
	if c.drawLabels {
		label, err = getRigLabel(rig)
		if err != nil {
			return fmt.Errorf("getting rig label: %v", err)
		}
	}

	r, err := renderer.NewRenderer(c.size, c.size, c.drawLabels, label)
	if err != nil {
		return fmt.Errorf("building renderer: %v", err)
	}
	defer r.Dispose()

	for _, l := range layers {
		i, err := m.layers.GetLayer(ctx, l.Path)
		if err != nil {
			return fmt.Errorf("getting layer: %v", err)
		}

		label := fmt.Sprintf("%d: %s: %s: %s", l.Position, l.Color, l.PartName, l.Path)

		if err := r.AddLayer(i, label); err != nil {
			return fmt.Errorf("adding layer to renderer: %v", err)
		}
	}

	if err := r.Write(writer, c.compression); err != nil {
		return fmt.Errorf("writing to renderer: %v", err)
	}

	return nil
}

func (m *Builder) getLayers(ctx context.Context, rig local.Rig, background bool) ([]local.Layer, error) {
	fleet, err := getFleet(rig)
	if err != nil {
		return nil, err
	}

	var nameAndColors []local.PartNameAndColor
	for _, part := range rig.Parts {
		if !background && part.Type == "Background" {
			continue
		}
		nameAndColors = append(nameAndColors, local.PartNameAndColor{PartName: part.Name, Color: part.Color.String})
	}
	return m.s.Layers(
		ctx,
		local.LayersOfFleet(fleet),
		local.LayersForParts(nameAndColors...),
		local.OrderLayersBy("position"),
	)
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
	value, _ := m.locks.LoadOrStore("fleets", &sync.RWMutex{})
	lock := value.(*sync.RWMutex)
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
	value, _ := m.locks.LoadOrStore(fleet, &sync.RWMutex{})
	lock := value.(*sync.RWMutex)
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
	value, _ := m.locks.LoadOrStore(fleet+partType, &sync.RWMutex{})
	lock := value.(*sync.RWMutex)
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
