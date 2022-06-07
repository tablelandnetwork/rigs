package tableland

import (
	"context"

	"github.com/tablelandnetwork/nft-minter/pkg/storage/common"
)

// Part describes a rig part.
type Part struct {
	Fleet    common.NullableString `json:"fleet"`
	Original common.NullableString `json:"original"`
	Type     string                `json:"type"`
	Name     string                `json:"name"`
	Color    common.NullableString `json:"color"`
}

// Layer describes an image layer used for rendering a rig.
type Layer struct {
	Fleet    string `json:"fleet"`
	Part     string `json:"part"`
	Position uint   `json:"position"`
	Path     string `json:"path"`
}

// RigAttribute holds rig attribute information.
type RigAttribute struct {
	DisplayType string      `json:"display_type,omitempty"`
	TraitType   string      `json:"trait_type"`
	Value       interface{} `json:"value"`
}

// Rig represents a generated rig.
type Rig struct {
	ID         int            `json:"id"`
	Image      string         `json:"image"`
	Attributes []RigAttribute `json:"attributes"`
}

// OriginalRig represents an original rig.
type OriginalRig struct {
	Fleet string
	Name  string
	Color string
}

// GetPartsConfig holds configuration calls to GetParts.
type GetPartsConfig struct {
	Fleet    string
	Original string
	Type     string
	Name     string
	Color    string
	OrderBy  string
}

// GetPartsOption controls the behavior of GetResults.
type GetPartsOption func(*GetPartsConfig)

// OfFleet filter resusts to the specified fleet.
func OfFleet(fleet string) GetPartsOption {
	return func(opts *GetPartsConfig) {
		opts.Fleet = fleet
	}
}

// OfOriginal filter resusts to the specified original.
func OfOriginal(original string) GetPartsOption {
	return func(opts *GetPartsConfig) {
		opts.Original = original
	}
}

// OfType filter resusts to the specified type.
func OfType(t string) GetPartsOption {
	return func(opts *GetPartsConfig) {
		opts.Type = t
	}
}

// OfName filter resusts to the specified name.
func OfName(name string) GetPartsOption {
	return func(opts *GetPartsConfig) {
		opts.Name = name
	}
}

// OfColor filter resusts to the specified color.
func OfColor(color string) GetPartsOption {
	return func(opts *GetPartsConfig) {
		opts.Color = color
	}
}

// OrderBy orders results by the specified column.
func OrderBy(orderBy string) GetPartsOption {
	return func(opts *GetPartsConfig) {
		opts.OrderBy = orderBy
	}
}

// Store defines a data store interface for rigs.
type Store interface {
	CreateTables(context.Context) error
	InsertParts(context.Context, []Part) error
	InsertLayers(context.Context, []Layer) error
	InsertRigs(context.Context, []Rig) error
	GetOriginalRigs(context.Context) ([]OriginalRig, error)
	GetPartTypesByFleet(context.Context, string) ([]string, error)
	GetParts(context.Context, ...GetPartsOption) ([]Part, error)
	GetLayers(context.Context, string, ...string) ([]Layer, error)
}
