package builder

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"  // register format
	_ "image/jpeg" // register format
	"image/png"
	"io"
	"sort"
	"sync"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	iface "github.com/ipfs/interface-go-ipfs-core"
	"github.com/ipfs/interface-go-ipfs-core/options"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/pkg/nullable"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/wpool"
	"golang.org/x/image/draw"
	"golang.org/x/time/rate"
)

const (
	fleetPartTypename      = "Fleet"
	backgroundPartTypeName = "Background"
)

var (
	defaultRenderConfig = renderConfig{
		size:        1200,
		thumbSize:   400,
		compression: png.DefaultCompression,
		drawLabels:  false,
	}
	defaultBuildImageConfig = assembleImageConfig{
		size:        1200,
		drawLabels:  false,
		background:  true,
		compression: png.DefaultCompression,
	}
)

// RandomnessSource defines the API for a source of random numbers.
type RandomnessSource interface {
	// GenRandoms returns n random numbers.
	GenRandoms(int) ([]float64, error)
}

// Builder builds Rigs.
type Builder struct {
	s      local.Store
	layers *Layers
	ipfs   iface.CoreAPI

	fleetsCache             []local.Part
	fleetPartTypesCache     map[string][]string
	fleetPartTypePartsCache map[string]map[string][]local.Part

	locks sync.Map
}

// NewBuilder creates a Builder.
func NewBuilder(
	s local.Store,
	ipfs iface.CoreAPI,
) *Builder {
	return &Builder{
		s:      s,
		layers: NewLayers(ipfs, s),
		ipfs:   ipfs,
	}
}

type buildConfig struct {
	id         int
	original   *local.OriginalRig
	randomness RandomnessSource
}

// BuildOption is an item that controls the behavior of Build.
type BuildOption func(*buildConfig)

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

// Build creates a Rig.
func (b *Builder) Build(ctx context.Context, option BuildOption) (*local.Rig, error) {
	c := buildConfig{}
	option(&c)

	var opt AssembleRigOption
	if c.original != nil {
		opt = AssembleOriginalRig(c.id, *c.original, c.randomness)
	} else {
		opt = AssembleRandomRig(c.id, c.randomness)
	}

	rig, err := b.AssembleRig(ctx, opt)
	if err != nil {
		return nil, fmt.Errorf("building rig data: %v", err)
	}

	if err := b.s.InsertRigs(ctx, []local.Rig{rig}); err != nil {
		return nil, fmt.Errorf("inserting rigs: %v", err)
	}

	return &rig, nil
}

type renderConfig struct {
	size        int
	thumbSize   int
	compression png.CompressionLevel
	drawLabels  bool
	gatewayURL  string
}

// RenderOption is an item that controls the behavior of Render.
type RenderOption func(*renderConfig)

// RenderSize controls the size of the created image.
func RenderSize(size int) RenderOption {
	return func(c *renderConfig) {
		c.size = size
	}
}

// RenderThumbSize controls the size of the created thumbnail image.
func RenderThumbSize(size int) RenderOption {
	return func(c *renderConfig) {
		c.thumbSize = size
	}
}

// RenderCompression controls the compression level of the created image.
func RenderCompression(level png.CompressionLevel) RenderOption {
	return func(c *renderConfig) {
		c.compression = level
	}
}

// RenderLabels controls wheterh or not to draw labels on the created image.
func RenderLabels(drawLabels bool) RenderOption {
	return func(c *renderConfig) {
		c.drawLabels = drawLabels
	}
}

// RenderGatewayURL sets the gateway field on the rig.
func RenderGatewayURL(url string) RenderOption {
	return func(rc *renderConfig) {
		rc.gatewayURL = url
	}
}

// Render renders the images for the provided rig and updates the store to reflect it.
func (b *Builder) Render(ctx context.Context, rig *local.Rig, opts ...RenderOption) error {
	c := defaultRenderConfig
	for _, opt := range opts {
		opt(&c)
	}

	reader, writer := io.Pipe()
	var readerData bytes.Buffer
	readerThrough := io.TeeReader(reader, &readerData)
	readerThumb, writerThumb := io.Pipe()

	readerAlpha, writerAlpha := io.Pipe()
	var readerAlphaData bytes.Buffer
	readerAlphaThrough := io.TeeReader(readerAlpha, &readerAlphaData)
	readerAlphaThumb, writerAlphaThumb := io.Pipe()

	defer func() {
		if err := reader.Close(); err != nil {
			log.Error().Err(err).Msg("closing reader")
		}
		if err := readerThumb.Close(); err != nil {
			log.Error().Err(err).Msg("closing reader thumb")
		}
		if err := readerAlpha.Close(); err != nil {
			log.Error().Err(err).Msg("closing reader alpha")
		}
		if err := readerAlphaThumb.Close(); err != nil {
			log.Error().Err(err).Msg("closing reader alpha thumb")
		}
	}()

	execFunc := func(
		rig local.Rig,
		writer *io.PipeWriter,
		readerData io.Reader,
		writerThumb *io.PipeWriter,
		background bool,
	) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			if err := b.AssembleImage(ctx, rig, writer,
				AssembleImageBackground(background),
				AssembleImageCompression(c.compression),
				AssembleImageLabels(c.drawLabels),
				AssembleImageSize(c.size),
			); err != nil {
				return nil, fmt.Errorf("assembling image: %v", err)
			}
			if err := writer.Close(); err != nil {
				return nil, fmt.Errorf("closing writer: %v", err)
			}
			thumbRect := image.Rect(0, 0, c.thumbSize, c.thumbSize)
			if err := resizeImage(readerData, thumbRect, writerThumb); err != nil {
				return nil, fmt.Errorf("resizing image: %v", err)
			}
			if err := writerThumb.Close(); err != nil {
				return nil, fmt.Errorf("closing thumb writer: %v", err)
			}
			return nil, nil
		}
	}

	jobs := []wpool.Job{
		{
			ID:     1,
			Desc:   "render images with background",
			ExecFn: execFunc(*rig, writer, &readerData, writerThumb, true),
		},
		{
			ID:     2,
			Desc:   "render images without backgrounds",
			ExecFn: execFunc(*rig, writerAlpha, &readerAlphaData, writerAlphaThumb, false),
		},
		{
			ID:   3,
			Desc: "add images to ipfs",
			ExecFn: func(ctx context.Context) (interface{}, error) {
				dir := ipfsfiles.NewMapDirectory(map[string]ipfsfiles.Node{
					"image.png":       ipfsfiles.NewReaderFile(readerThrough),
					"image_alpha.png": ipfsfiles.NewReaderFile(readerAlphaThrough),
					"thumb.png":       ipfsfiles.NewReaderFile(readerThumb),
					"thumb_alpha.png": ipfsfiles.NewReaderFile(readerAlphaThumb),
				})
				path, err := b.ipfs.Unixfs().Add(
					ctx,
					dir,
					options.Unixfs.Pin(true),
					options.Unixfs.CidVersion(1),
				)
				if err != nil {
					return nil, fmt.Errorf("adding image to ipfs: %v", err)
				}
				return path, nil
			},
		},
	}

	wp := wpool.New(3, rate.Inf)
	go wp.GenerateFrom(jobs)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go wp.Run(ctx)

	var path ipfspath.Path

Loop:
	for {
		select {
		case r, ok := <-wp.Results():
			if !ok {
				break
			}
			if r.Err != nil {
				return r.Err
			}
			if r.ID == wpool.JobID(3) {
				path = r.Value.(ipfspath.Path)
			}
		case <-wp.Done:
			break Loop
		}
	}

	rig.Gateway = nullable.FromString(c.gatewayURL, nullable.EmptyIsNull())
	rig.Images = nullable.FromString(path.String())
	rig.Image = nullable.FromString(path.String() + "/image.png")
	rig.ImageAlpha = nullable.FromString(path.String() + "/image_alpha.png")
	rig.Thumb = nullable.FromString(path.String() + "/thumb.png")
	rig.ThumbAlpha = nullable.FromString(path.String() + "/thumb_alpha.png")

	if err := b.s.UpdateRigImages(ctx, *rig); err != nil {
		b.unpinPath(ctx, path)
		return fmt.Errorf("updating rig: %v", err)
	}

	return nil
}

func (b *Builder) unpinPath(ctx context.Context, path ipfspath.Path) {
	if err := b.ipfs.Pin().Rm(ctx, path); err != nil {
		log.Error().Err(err).Msg("unpinning from local ipfs")
	}
}

type assembleRigConfig struct {
	id         int
	original   *local.OriginalRig
	randomness RandomnessSource
}

// AssembleRigOption is an item that controls the behavior of BuildData.
type AssembleRigOption func(*assembleRigConfig)

// AssembleRandomRig provides configuration for random rig building.
func AssembleRandomRig(id int, randomnessSource RandomnessSource) AssembleRigOption {
	return func(c *assembleRigConfig) {
		c.id = id
		c.randomness = randomnessSource
	}
}

// AssembleOriginalRig provides configuration for building original rigs.
func AssembleOriginalRig(id int, original local.OriginalRig, randomnessSource RandomnessSource) AssembleRigOption {
	return func(c *assembleRigConfig) {
		c.id = id
		c.original = &original
		c.randomness = randomnessSource
	}
}

// AssembleRig generates Rig data.
func (b *Builder) AssembleRig(ctx context.Context, opt AssembleRigOption) (local.Rig, error) {
	c := assembleRigConfig{}
	opt(&c)

	var rig local.Rig
	var err error

	if c.original != nil {
		rig, err = b.assembleOriginalRig(ctx, c.id, *c.original, c.randomness)
	} else {
		rig, err = b.assembleRandomRig(ctx, c.id, c.randomness)
	}
	if err != nil {
		return local.Rig{}, fmt.Errorf("building rig data: %v", err)
	}

	rig.PercentOriginal = percentOriginal(rig.Parts, 0)
	rig.PercentOriginal50 = percentOriginal(rig.Parts, 0.5)
	rig.PercentOriginal75 = percentOriginal(rig.Parts, 0.75)
	rig.PercentOriginal90 = percentOriginal(rig.Parts, 0.90)
	if rig.PercentOriginal == 1 {
		rig.Original = true
	}
	return rig, nil
}

func (b *Builder) assembleRandomRig(
	ctx context.Context,
	id int,
	rs RandomnessSource,
) (local.Rig, error) {
	rig := local.Rig{ID: id}

	fleets, err := b.fleets(ctx)
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

	partTypes, err := b.fleetPartTypes(ctx, fleetPart.Name)
	if err != nil {
		return local.Rig{}, fmt.Errorf("getting fleet part types: %v", err)
	}

	if len(partTypes) > len(randoms)-1 {
		return local.Rig{}, errors.New("more part types than random numbers")
	}

	for i, partType := range partTypes {
		parts, err := b.fleetPartTypeParts(
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

	if percentOriginal(rig.Parts, 0) == 1 {
		log.Info().Msg("randomly generated original, ignoring and retrying")
		return b.assembleRandomRig(ctx, id, rs)
	}
	return rig, nil
}

func (b *Builder) assembleOriginalRig(
	ctx context.Context,
	id int,
	original local.OriginalRig,
	rs RandomnessSource,
) (local.Rig, error) {
	rig := local.Rig{ID: id}

	fleetParts, err := b.s.Parts(ctx, local.PartsOfType("Fleet"), local.PartsOfName(original.Fleet))
	if err != nil {
		return local.Rig{}, fmt.Errorf("getting fleet part: %v", err)
	}
	if len(fleetParts) != 1 {
		return local.Rig{}, fmt.Errorf("should have found 1 fleet part, but found %d", len(fleetParts))
	}

	fleetPart := fleetParts[0]

	rig.Parts = append(rig.Parts, fleetPart)

	partTypes, err := b.fleetPartTypes(ctx, fleetPart.Name)
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

		parts, err := b.s.Parts(ctx, options...)
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

type assembleImageConfig struct {
	drawLabels  bool
	size        int
	background  bool
	compression png.CompressionLevel
}

// AssembleImageOption controls the behavior of BuildImage.
type AssembleImageOption func(*assembleImageConfig)

// AssembleImageLabels specifies whether or not to render labels.
func AssembleImageLabels(labels bool) AssembleImageOption {
	return func(bic *assembleImageConfig) {
		bic.drawLabels = labels
	}
}

// AssembleImageSize specifies the size of the image to render.
func AssembleImageSize(size int) AssembleImageOption {
	return func(bic *assembleImageConfig) {
		bic.size = size
	}
}

// AssembleImageBackground specifies whether or not to render the background.
func AssembleImageBackground(background bool) AssembleImageOption {
	return func(bic *assembleImageConfig) {
		bic.background = background
	}
}

// AssembleImageCompression controls the compression level of the image.
func AssembleImageCompression(compression png.CompressionLevel) AssembleImageOption {
	return func(bic *assembleImageConfig) {
		bic.compression = compression
	}
}

// AssembleImage writes the Rig image to the provided Writer for the provided Rig.
func (b *Builder) AssembleImage(
	ctx context.Context,
	rig local.Rig,
	writer io.Writer,
	opts ...AssembleImageOption,
) error {
	c := defaultBuildImageConfig
	for _, opt := range opts {
		opt(&c)
	}

	layers, err := b.getLayers(ctx, rig, c.background)
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
		i, err := b.layers.GetLayer(ctx, l.Path)
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

func (b *Builder) getLayers(ctx context.Context, rig local.Rig, background bool) ([]local.Layer, error) {
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
	return b.s.Layers(
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

func percentOriginal(parts []local.Part, bonusFactor float64) float64 {
	originalColorCounts := make(map[string]map[string]int)
	type originalMax struct {
		color string
		max   int
	}
	originalColorMaximums := make(map[string]originalMax)
	total := 0
	for _, part := range parts {
		if !part.Color.Valid || !part.Original.Valid {
			continue
		}
		if _, exists := originalColorCounts[part.Original.String]; !exists {
			originalColorCounts[part.Original.String] = make(map[string]int)
		}
		originalColorCounts[part.Original.String][part.Color.String]++
		if originalColorCounts[part.Original.String][part.Color.String] > originalColorMaximums[part.Original.String].max {
			originalColorMaximums[part.Original.String] = originalMax{
				color: part.Color.String,
				max:   originalColorCounts[part.Original.String][part.Color.String],
			}
		}
		total++
	}
	var max float64
	for original, colorCounts := range originalColorCounts {
		var score float64
		for color, count := range colorCounts {
			if color == originalColorMaximums[original].color {
				score += float64(count)
			} else {
				score += float64(count) * bonusFactor
			}
		}
		if score > max {
			max = score
		}
	}
	return max / float64(total)
}

func resizeImage(data io.Reader, size image.Rectangle, to io.Writer) error {
	i, _, err := image.Decode(data)
	if err != nil {
		return err
	}
	dst := image.NewRGBA(size)
	draw.CatmullRom.Scale(dst, size, i, i.Bounds(), draw.Over, nil)
	if err := png.Encode(to, dst); err != nil {
		return err
	}
	return nil
}

func (b *Builder) fleets(ctx context.Context) ([]local.Part, error) {
	value, _ := b.locks.LoadOrStore("fleets", &sync.RWMutex{})
	lock := value.(*sync.RWMutex)
	lock.Lock()
	defer lock.Unlock()

	if b.fleetsCache == nil || len(b.fleetsCache) == 0 {
		fleets, err := b.s.Parts(ctx, local.PartsOfType("Fleet"))
		if err != nil {
			return nil, fmt.Errorf("getting parts of fleet type: %v", err)
		}
		b.fleetsCache = fleets
	}
	return b.fleetsCache, nil
}

func (b *Builder) fleetPartTypes(ctx context.Context, fleet string) ([]string, error) {
	value, _ := b.locks.LoadOrStore(fleet, &sync.RWMutex{})
	lock := value.(*sync.RWMutex)
	lock.Lock()
	defer lock.Unlock()

	if b.fleetPartTypesCache == nil {
		b.fleetPartTypesCache = make(map[string][]string)
	}
	if partTypes, ok := b.fleetPartTypesCache[fleet]; ok {
		return partTypes, nil
	}
	partTypes, err := b.s.GetPartTypesByFleet(ctx, fleet)
	if err != nil {
		return nil, err
	}
	b.fleetPartTypesCache[fleet] = partTypes
	return partTypes, nil
}

func (b *Builder) fleetPartTypeParts(ctx context.Context, fleet string, partType string) ([]local.Part, error) {
	value, _ := b.locks.LoadOrStore(fleet+partType, &sync.RWMutex{})
	lock := value.(*sync.RWMutex)
	lock.Lock()
	defer lock.Unlock()

	if b.fleetPartTypePartsCache == nil {
		b.fleetPartTypePartsCache = make(map[string]map[string][]local.Part)
	}
	if b.fleetPartTypePartsCache[fleet] == nil {
		b.fleetPartTypePartsCache[fleet] = make(map[string][]local.Part)
	}
	if parts, ok := b.fleetPartTypePartsCache[fleet][partType]; ok {
		return parts, nil
	}
	parts, err := b.s.Parts(ctx, local.PartsOfFleet(fleet), local.PartsOfType(partType))
	if err != nil {
		return nil, err
	}
	b.fleetPartTypePartsCache[fleet][partType] = parts
	return parts, nil
}
