package renderer

import (
	"fmt"
	"image"
	_ "image/gif"  // register format
	_ "image/jpeg" // register format
	"image/png"
	"io"
	"math"
	"os"
	"strings"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"github.com/tablelandnetwork/rigs/pkg/renderer/fonts"
	"golang.org/x/image/draw"
	"golang.org/x/image/math/fixed"
)

var (
	lfont  *truetype.Font
	lxoff  = 1.8
	lyoff  = 1.2
	ldpi   = 300.0
	lscale = 240
	lcolor = image.Black
)

func init() {
	data, err := fonts.Asset("Inconsolata-Regular.ttf")
	if err != nil {
		panic("failed to load font")
	}
	lfont, err = freetype.ParseFont(data)
	if err != nil {
		panic("failed to parse font")
	}
}

// Renderer is used to render image layers.
type Renderer struct {
	img *image.RGBA

	drawLabels bool
	labels     []string
	fctx       *freetype.Context
	fontSize   float64
	labelXPos  fixed.Int26_6
	labelYPos  fixed.Int26_6
}

// NewRenderer returns a new Renderer.
func NewRenderer(width, height int, drawLabels bool, label string) (*Renderer, error) {
	i := image.NewRGBA(image.Rect(0, 0, width, height))

	fs := math.Max(1, float64(width/lscale))
	c := freetype.NewContext()
	c.SetFont(lfont)
	c.SetDPI(ldpi)
	c.SetFontSize(fs)
	c.SetClip(i.Bounds())
	c.SetDst(i)
	c.SetSrc(lcolor)

	r := &Renderer{
		img:        i,
		drawLabels: drawLabels,
		fctx:       c,
		fontSize:   fs,
		labelXPos:  c.PointToFixed(fs / lxoff),
		labelYPos:  0,
	}

	if drawLabels && len(label) > 0 {
		r.labels = append(r.labels, label)
	}
	return r, nil
}

// AddLayer to the Renderer.
func (r *Renderer) AddLayer(layer image.Image, label string) error {
	var scaled image.Image
	if !layer.Bounds().Eq(r.img.Bounds()) {
		tmp := image.NewRGBA(r.img.Bounds())
		draw.ApproxBiLinear.Scale(tmp, tmp.Rect, layer, layer.Bounds(), draw.Over, nil)
		scaled = tmp
	} else {
		scaled = layer
	}
	draw.Draw(r.img, r.img.Bounds(), scaled, image.Point{}, draw.Over)

	if r.drawLabels && len(label) > 0 {
		r.labels = append(r.labels, label)
	}
	return nil
}

// AddLayerByFile add a layer loaded from disk to the Renderer.
func (r *Renderer) AddLayerByFile(layer string, label string) error {
	f, err := os.Open(layer)
	if err != nil {
		return fmt.Errorf("opening file: %v", err)
	}
	defer func() { _ = f.Close() }()

	i, _, err := image.Decode(f)
	if err != nil {
		return fmt.Errorf("decoding image %s: %v", f.Name(), err)
	}
	return r.AddLayer(i, label)
}

func (r *Renderer) drawLabel(label string) error {
	for _, s := range strings.Split(label, "\n") {
		r.labelYPos += r.fctx.PointToFixed(r.fontSize * lyoff)
		pt := freetype.Pt(int(r.labelXPos>>6), int(r.labelYPos>>6))
		if _, err := r.fctx.DrawString(s, pt); err != nil {
			return err
		}
	}
	return nil
}

// Write the layers to a PNG.
func (r *Renderer) Write(writer io.Writer, compression png.CompressionLevel) error {
	for i, l := range r.labels {
		if err := r.drawLabel(l); err != nil {
			return fmt.Errorf("drawing label: %v", err)
		}
		if i == 0 {
			r.labelYPos += r.fctx.PointToFixed(r.fontSize * lyoff)
		}
	}

	encoder := png.Encoder{
		CompressionLevel: compression,
	}
	return encoder.Encode(writer, r.img)
}

// Dispose of the Renderer image.
func (r *Renderer) Dispose() {
	r.img = nil
}
