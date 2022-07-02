package local

import (
	"context"

	"github.com/tablelandnetwork/nft-minter/pkg/nullable"
)

// Part describes a rig part.
type Part struct {
	ID       uint            `json:"id"`
	Fleet    nullable.String `json:"fleet"`
	Original nullable.String `json:"original"`
	Type     string          `json:"type"`
	Name     string          `json:"name"`
	Color    nullable.String `json:"color"`
}

// Layer describes an image layer used for rendering a rig.
type Layer struct {
	ID       uint   `json:"id"`
	Fleet    string `json:"fleet"`
	Color    string `json:"color"`
	PartName string `json:"part_name" db:"part_name"`
	PartType string `json:"part_type" db:"part_type"`
	Position uint   `json:"position"`
	Path     string `json:"path"`
}

// Rig represents a generated rig.
type Rig struct {
	ID                int             `json:"id"`
	Gateway           nullable.String `json:"gateway"`
	Images            nullable.String `json:"images"`
	Image             nullable.String `json:"image"`
	ImageAlpha        nullable.String `json:"image_alpha" db:"image_alpha"`
	Thumb             nullable.String `json:"thumb"`
	ThumbAlpha        nullable.String `json:"thumb_alpha" db:"thumb_alpha"`
	Original          bool            `json:"original"`
	PercentOriginal   float64         `json:"percent_original" db:"percent_original"`
	PercentOriginal50 float64         `json:"percent_original_50" db:"percent_original_50"`
	PercentOriginal75 float64         `json:"percent_original_75" db:"percent_original_75"`
	PercentOriginal90 float64         `json:"percent_original_90" db:"percent_original_90"`
	VIN               string          `json:"vin"`
	Parts             []Part          `json:"parts"`
}

// OriginalRig represents an original rig.
type OriginalRig struct {
	Fleet string `json:"fleet"`
	Name  string `json:"name" db:"original"`
	Color string `json:"color"`
}

// PartsConfig holds configuration calls to Parts.
type PartsConfig struct {
	Fleet    string
	Original string
	PartType string
	Name     string
	Color    string
	OrderBy  string
	Limit    *uint
	Offset   *uint
}

// PartsOption controls the behavior of Parts.
type PartsOption func(*PartsConfig)

// PartsOfFleet filters resusts to the specified fleet.
func PartsOfFleet(fleet string) PartsOption {
	return func(opts *PartsConfig) {
		opts.Fleet = fleet
	}
}

// PartsOfOriginal filters resusts to the specified original.
func PartsOfOriginal(original string) PartsOption {
	return func(opts *PartsConfig) {
		opts.Original = original
	}
}

// PartsOfType filters resusts to the specified type.
func PartsOfType(t string) PartsOption {
	return func(opts *PartsConfig) {
		opts.PartType = t
	}
}

// PartsOfName filters resusts to the specified name.
func PartsOfName(name string) PartsOption {
	return func(opts *PartsConfig) {
		opts.Name = name
	}
}

// PartsOfColor filters resusts to the specified color.
func PartsOfColor(color string) PartsOption {
	return func(opts *PartsConfig) {
		opts.Color = color
	}
}

// OrderPartsBy orders results by the specified column asc.
func OrderPartsBy(orderBy string) PartsOption {
	return func(opts *PartsConfig) {
		opts.OrderBy = orderBy
	}
}

// PartsWithLimit limits the number of results returned.
func PartsWithLimit(limit uint) PartsOption {
	return func(pc *PartsConfig) {
		pc.Limit = &limit
	}
}

// PartsWithOffset offsets the beginning of the results returned.
func PartsWithOffset(offset uint) PartsOption {
	return func(pc *PartsConfig) {
		pc.Offset = &offset
	}
}

// LayersConfig holds configuration calls to Layers.
type LayersConfig struct {
	Fleet   string
	Parts   []PartNameAndColor
	OrderBy string
	Limit   *uint
	Offset  *uint
}

// LayersOption controls the behavior of Layers.
type LayersOption func(*LayersConfig)

// LayersOfFleet filters results to the specified fleet.
func LayersOfFleet(fleet string) LayersOption {
	return func(lc *LayersConfig) {
		lc.Fleet = fleet
	}
}

// PartNameAndColor is used to query Layers by part name and color.
type PartNameAndColor struct {
	PartName string
	Color    string
}

// LayersForParts filters results to the specified parts.
func LayersForParts(parts ...PartNameAndColor) LayersOption {
	return func(lc *LayersConfig) {
		lc.Parts = parts
	}
}

// OrderLayersBy orders results by the specified column asc.
func OrderLayersBy(orderBy string) LayersOption {
	return func(lc *LayersConfig) {
		lc.OrderBy = orderBy
	}
}

// LayersWithLimit limits the number of results returned.
func LayersWithLimit(limit uint) LayersOption {
	return func(lc *LayersConfig) {
		lc.Limit = &limit
	}
}

// LayersWithOffset offsets the beginning of the results returned.
func LayersWithOffset(offset uint) LayersOption {
	return func(lc *LayersConfig) {
		lc.Offset = &offset
	}
}

// RigsConfig holds configuration for calls to Rigs.
type RigsConfig struct {
	Limit  *uint
	Offset *uint
}

// RigsOption controls the behavior of Rigs.
type RigsOption func(*RigsConfig)

// RigsWithLimit limits the number of results.
func RigsWithLimit(limit uint) RigsOption {
	return func(rc *RigsConfig) {
		rc.Limit = &limit
	}
}

// RigsWithOffset specifies the offset of the results.
func RigsWithOffset(offset uint) RigsOption {
	return func(rc *RigsConfig) {
		rc.Offset = &offset
	}
}

// Counts holds the number or original and random rigs.
type Counts struct {
	Originals int
	Randoms   int
}

// Ranking represents rank data.
type Ranking struct {
	Name       string
	Count      int
	Percentage float64
}

// Store describes the local data store API.
type Store interface {
	// InsertParts inserts the Parts.
	InsertParts(ctx context.Context, parts []Part) error

	// InsertLayers inserts Layers.
	InsertLayers(ctx context.Context, layers []Layer) error

	// InsertRigs inserts Rigs and their Parts.
	InsertRigs(ctx context.Context, rigs []Rig) error

	// UpdateRigImages updates Rig image-related fields.
	UpdateRigImages(ctx context.Context, rig Rig) error

	// GetOriginalRigs gets a list of all OriginalRigs.
	GetOriginalRigs(ctx context.Context) ([]OriginalRig, error)

	// GetPartTypesByFleet returns a list of party types for the specified fleet.
	GetPartTypesByFleet(ctx context.Context, fleet string) ([]string, error)

	// Parts returns a list of parts filtered according to the provided options.
	Parts(ctx context.Context, opts ...PartsOption) ([]Part, error)

	// Layers returns a list of Layers for the specified fleet and part name/colors.
	Layers(ctx context.Context, opts ...LayersOption) ([]Layer, error)

	// Rigs returns a list of Rigs.
	Rigs(ctx context.Context, opts ...RigsOption) ([]Rig, error)

	// Counts returns the number of original rigs and random rigs.
	Counts(ctx context.Context) (Counts, error)

	// FleetRankings returns a list of fleets and how commonly they occur.
	FleetRankings(ctx context.Context) ([]Ranking, error)

	// BackgroundColorRankings returns a list of background colors and how commonly they occur.
	BackgroundColorRankings(ctx context.Context) ([]Ranking, error)

	// OriginalRankings returns a list of original rankings for the specified fleet.
	OriginalRankings(ctx context.Context, fleet string) ([]Ranking, error)

	// ClearInventory empties the parts and layers records.
	ClearInventory(ctx context.Context) error

	// ClearRigs empties the rigs records.
	ClearRigs(ctx context.Context) error

	// Reset clears the db and starts fresh.
	Reset(ctx context.Context) error
}
