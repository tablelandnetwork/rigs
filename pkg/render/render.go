package render

import (
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
	"github.com/tablelandnetwork/nft-minter/pkg/render/fonts"
	"golang.org/x/image/math/fixed"
)

var (
	font *truetype.Font

	lxoff  = 1.8
	lyoff  = 1.2
	ldpi   = 300.0
	lscale = 128
	lcolor = image.White
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

	labels    bool
	fctx      *freetype.Context
	fontSize  float64
	labelXPos fixed.Int26_6
	labelYPos fixed.Int26_6
}

// NewRenderer returns a new Renderer.
func NewRenderer(width, height int, drawLabels bool, label string) (*Renderer, error) {
	i := image.NewRGBA(image.Rect(0, 0, width, height))
	c := freetype.NewContext()
	c.SetDPI(ldpi)
	c.SetFont(font)
	fs := math.Max(1, float64(width/lscale))
	c.SetFontSize(fs)
	c.SetClip(i.Bounds())
	c.SetDst(i)
	c.SetSrc(lcolor)

	r := &Renderer{
		img:       i,
		labels:    drawLabels,
		fctx:      c,
		fontSize:  fs,
		labelXPos: c.PointToFixed(fs / lxoff),
		labelYPos: 0,
	}

	if drawLabels && len(label) > 0 {
		if err := r.drawLabel(label); err != nil {
			return nil, fmt.Errorf("drawing trait label: %v", err)
		}
		r.labelYPos += r.fctx.PointToFixed(r.fontSize * lyoff)
	}
	return r, nil
}

// AddLayer to the Renderer.
func (r *Renderer) AddLayer(layer image.Image, label string) error {
	draw.Draw(r.img, r.img.Bounds(), layer, image.Point{}, draw.Over)

	if r.labels && len(label) > 0 {
		if err := r.drawLabel(label); err != nil {
			return fmt.Errorf("drawing layer label: %v", err)
		}
	}
	return nil
}

func (r *Renderer) drawLabel(label string) error {
	r.labelYPos += r.fctx.PointToFixed(r.fontSize * lyoff)
	pt := freetype.Pt(int(r.labelXPos>>6), int(r.labelYPos>>6))
	_, err := r.fctx.DrawString(label, pt)
	return err
}

// Write the layers to a PNG.
func (r *Renderer) Write(writer io.Writer, compression png.CompressionLevel) error {
	encoder := png.Encoder{
		CompressionLevel: compression,
	}
	return encoder.Encode(writer, r.img)
}
