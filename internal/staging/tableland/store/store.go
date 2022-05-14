package store

import (
	"context"
	"database/sql"
	"encoding/json"
)

type NullableString sql.NullString
type NullableInt16 sql.NullInt16

func (x *NullableString) MarshalJSON() ([]byte, error) {
	if !x.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(x.String)
}

func (x *NullableString) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &x.String)
	x.Valid = (err == nil)
	return err
}

func (x *NullableInt16) MarshalJSON() ([]byte, error) {
	if !x.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(x.Int16)
}

func (x *NullableInt16) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &x.Int16)
	x.Valid = (err == nil)
	return err
}

type Part struct {
	Fleet    NullableString `json:"fleet"`
	Original NullableString `json:"original"`
	Type     string         `json:"type"`
	Name     string         `json:"name"`
	Color    NullableString `json:"color"`
	Rank     NullableInt16  `json:"rank"`
}

type Layer struct {
	Fleet     string `json:"fleet"`
	PartName  string `json:"partName"`
	PartColor string `json:"partColor"`
	Position  uint   `json:"position"`
	Path      string `json:"path"`
}

type Distribution struct {
	Fleet        NullableString
	PartType     string
	Distribution string
}

type GetPartsOptions struct {
	Fleet    string
	Original string
	Type     string
	Name     string
	Color    string
	OrderBy  string
}

type GetPartsOption func(*GetPartsOptions) error

func WithFleet(fleet string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Fleet = fleet
		return nil
	}
}

func WithOriginal(original string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Original = original
		return nil
	}
}

func WithType(t string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Type = t
		return nil
	}
}

func WithName(name string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Name = name
		return nil
	}
}

func WithColor(color string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Color = color
		return nil
	}
}

func OrderBy(orderBy string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.OrderBy = orderBy
		return nil
	}
}

type Store interface {
	CreateTables(context.Context) error
	InsertParts(context.Context, []Part) error
	InsertPart(context.Context, Part) error
	InsertLayers(context.Context, []Layer) error
	InsertLayer(context.Context, Layer) error
	InsertDistributions(context.Context, []Distribution) error
	InsertDistribution(context.Context, Distribution) error
	GetParts(context.Context, ...GetPartsOption) ([]Part, error)
}
