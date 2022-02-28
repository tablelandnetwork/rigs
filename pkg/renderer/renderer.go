package renderer

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"  // register format
	_ "image/jpeg" // register format
	"image/png"
	"io"
	"math"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer/fonts"
	"golang.org/x/image/math/fixed"
)

var (
	font *truetype.Font

	lxoff  = 1.8
	lyoff  = 1.2
	ldpi   = 300.0
	lscale = 128
)

func init() {
	data, err := fonts.Asset("Inconsolata-Regular.ttf")
	if err != nil {
		panic("failed to load font")
	}
	font, err = freetype.ParseFont(data)
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
func NewRenderer(width, height int, drawLabels bool, label string, darkMode bool) (*Renderer, error) {
	i := image.NewRGBA(image.Rect(0, 0, width, height))
	c := freetype.NewContext()
	c.SetDPI(ldpi)
	c.SetFont(font)
	fs := math.Max(1, float64(width/lscale))
	c.SetFontSize(fs)
	c.SetClip(i.Bounds())
	c.SetDst(i)
	if darkMode {
		c.SetSrc(image.White)
	} else {
		c.SetSrc(image.Black)
	}

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
func (r *Renderer) AddLayer(layer []byte, label string) error {
	i, _, err := image.Decode(bytes.NewReader(layer))
	if err != nil {
		return fmt.Errorf("decoding image: %v", err)
	}

	draw.Draw(r.img, r.img.Bounds(), i, image.Point{}, draw.Over)

	if r.drawLabels && len(label) > 0 {
		r.labels = append(r.labels, label)
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

func (r *Renderer) drawLabel(label string) error {
	r.labelYPos += r.fctx.PointToFixed(r.fontSize * lyoff)
	pt := freetype.Pt(int(r.labelXPos>>6), int(r.labelYPos>>6))
	_, err := r.fctx.DrawString(label, pt)
	return err
}
