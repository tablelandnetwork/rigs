package staging

import (
	"context"
	"image"
	"image/png"
	"io"
)

// Trait defines a single NFT trait.
type Trait struct {
	DisplayType string      `json:"display_type,omitempty"`
	TraitType   string      `json:"trait_type"`
	Value       interface{} `json:"value"`
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
	File  string
}

// Metadata defines NFT metadata.
type Metadata struct {
	ID         int     `json:"id"`
	Attributes []Trait `json:"attributes"`
}

// Rarity is a measure of how rare Metadata is.
type Rarity float64

// GeneratedMetadata includes Metadata and associated Rarity.
type GeneratedMetadata struct {
	Metadata Metadata `json:"metadata"`
	Rarity   Rarity   `json:"rarity"`
}

// Service is used to generate nft metadata for development.
type Service interface {
	GenerateMetadata(ctx context.Context, count int, reload bool) ([]GeneratedMetadata, error)
	RenderImage(
		ctx context.Context,
		m Metadata,
		seeds []float64,
		width, height int,
		compression png.CompressionLevel,
		drawLabels, reloadLayers bool,
		w io.Writer,
	) error
}
