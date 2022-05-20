package store

import (
	"context"
	"database/sql"
	"encoding/json"
)

type NullableString struct {
	sql.NullString
}

func (ns *NullableString) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ns.String)
}

func (ns *NullableString) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &ns.String)
	ns.Valid = (err == nil)
	return err
}

type NullableInt16 struct {
	sql.NullInt16
}

func (ni *NullableInt16) MarshalJSON() ([]byte, error) {
	if !ni.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ni.Int16)
}

func (ni *NullableInt16) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &ni.Int16)
	ni.Valid = (err == nil)
	return err
}

type Part struct {
	Fleet    NullableString `json:"fleet"`
	Original NullableString `json:"original"`
	Type     string         `json:"type"`
	Name     string         `json:"name"`
	Color    NullableString `json:"color"`
	Rank     int            `json:"rank"`
}

type Layer struct {
	Fleet    string `json:"fleet"`
	Part     string `json:"part"`
	Position uint   `json:"position"`
	Path     string `json:"path"`
}

type Distribution struct {
	Fleet        NullableString `json:"fleet"`
	PartType     string         `json:"part_type"`
	Distribution string         `json:"distribution"`
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

func OfFleet(fleet string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Fleet = fleet
		return nil
	}
}

func OfOriginal(original string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Original = original
		return nil
	}
}

func OfType(t string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Type = t
		return nil
	}
}

func OfName(name string) GetPartsOption {
	return func(opts *GetPartsOptions) error {
		opts.Name = name
		return nil
	}
}

func OfColor(color string) GetPartsOption {
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
	GetPartTypesByFleet(context.Context, string) ([]string, error)
	GetPartTypeDistributionForFleets(context.Context) (string, error)
	GetPartTypeDistributionsByFleet(context.Context, string) ([]Distribution, error)
	GetParts(context.Context, ...GetPartsOption) ([]Part, error)
	GetLayers(context.Context, string, ...string) ([]Layer, error)
}
