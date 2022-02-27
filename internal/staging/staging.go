package staging

import (
	"context"
	"image"
	"image/png"
	"io"
)

// Trait defines a single NFT trait.
type Trait struct {
	DisplayType string `json:"display_type,omitempty"`
	TraitType   string `json:"trait_type"`
	Value       string `json:"value"`
}

// Layer defines a layer associated with a trait.
type Layer struct {
	Name  string
	Trait *Trait
}

// Image is an image associated with a layer.
type Image struct {
	ID    string
	Layer string
	Image image.Image
}

// Metadata defines NFT metadata.
type Metadata struct {
	Attributes []Trait `json:"attributes"`
}

// Service is used to generate nft metadata for development.
type Service interface {
	GenerateMetadata(ctx context.Context, count int, reload bool) ([]Metadata, error)
	RenderImage(
		ctx context.Context,
		m Metadata,
		width, height int,
		compression png.CompressionLevel,
		drawLabels, reloadLayers bool,
		w io.Writer,
	) error
}
