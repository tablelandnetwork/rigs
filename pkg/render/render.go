package render

import (
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"math"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"github.com/tablelandnetwork/nft-minter/pkg/render/fonts"
	"golang.org/x/image/math/fixed"
)

var font *truetype.Font

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

	labels   bool
	fctx     *freetype.Context
	fontSize float64
	labelPos fixed.Int26_6
}

// NewRenderer returns a new Renderer.
func NewRenderer(width, height int, drawLabels bool) *Renderer {
	i := image.NewRGBA(image.Rect(0, 0, width, height))
	c := freetype.NewContext()
	c.SetDPI(300)
	c.SetFont(font)
	fs := math.Max(1, float64(width/128))
	c.SetFontSize(fs)
	c.SetClip(i.Bounds())
	c.SetDst(i)
	c.SetSrc(image.Black)

	return &Renderer{
		img:      i,
		labels:   drawLabels,
		fctx:     c,
		fontSize: fs,
	}
}

// AddLayer to the Renderer.
func (r *Renderer) AddLayer(layer image.Image, label string) error {
	draw.Draw(r.img, r.img.Bounds(), layer, image.Point{}, draw.Over)

	if r.labels && len(label) > 0 {
		xpos := r.fctx.PointToFixed(r.fontSize / 1.8)
		r.labelPos += r.fctx.PointToFixed(r.fontSize * 1.2)
		pt := freetype.Pt(int(xpos>>6), int(r.labelPos>>6))
		if _, err := r.fctx.DrawString(label, pt); err != nil {
			return fmt.Errorf("drawing label: %v", err)
		}
	}
	return nil
}

// Write the layers to a PNG.
func (r *Renderer) Write(writer io.Writer, compression png.CompressionLevel) error {
	encoder := png.Encoder{
		CompressionLevel: compression,
	}
	return encoder.Encode(writer, r.img)
}
