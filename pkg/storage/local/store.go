package local

import (
	"context"
	"time"

	"github.com/ipfs/go-cid"
	"github.com/tablelandnetwork/rigs/pkg/nullable"
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

// Deal describes a Filecoin storage deal.
type Deal struct {
	DealID            uint64     `json:"deal_id" db:"deal_id"`
	StorageProvider   string     `json:"storage_provider" db:"storage_provider"`
	Status            string     `json:"status" db:"status"`
	PieceCid          string     `json:"piece_cid" db:"piece_cid"`
	DataCid           string     `json:"data_cid" db:"data_cid"`
	DataModelSelector string     `json:"data_model_selector" db:"data_model_selector"`
	Activation        *time.Time `json:"activation" db:"activation"`
	Updated           time.Time  `json:"updated" db:"updated"`
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
	ID                int     `json:"id"`
	Original          bool    `json:"original"`
	RendersCid        *string `json:"renders_cid" db:"renders_cid"`
	PercentOriginal   float64 `json:"percent_original" db:"percent_original"`
	PercentOriginal50 float64 `json:"percent_original_50" db:"percent_original_50"`
	PercentOriginal75 float64 `json:"percent_original_75" db:"percent_original_75"`
	PercentOriginal90 float64 `json:"percent_original_90" db:"percent_original_90"`
	VIN               string  `json:"vin"`
	Parts             []Part  `json:"parts"`
	Deals             []Deal  `json:"deals"`
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
	IDs    []string
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

// RigsWithIDs filters results to the specified ids.
func RigsWithIDs(ids []string) RigsOption {
	return func(rc *RigsConfig) {
		rc.IDs = ids
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

// TrackedCid is a tracked cid.
type TrackedCid struct {
	Label string `db:"label"`
	Cid   string `db:"cid"`
}

// TrackedTableName is a tracked table.
type TrackedTableName struct {
	ChainID int64  `db:"chain_id"`
	Label   string `db:"label"`
	Name    string `db:"name"`
}

// Store describes the local data store API.
type Store interface {
	// InsertParts inserts the Parts.
	InsertParts(ctx context.Context, parts []Part) error

	// InsertLayers inserts Layers.
	InsertLayers(ctx context.Context, layers []Layer) error

	// InsertRigs inserts Rigs and their Parts.
	InsertRigs(ctx context.Context, rigs []Rig) error

	// UpdateRigRendersCid sets the cid for the rig.
	UpdateRigRendersCid(ctx context.Context, rigID int, cid cid.Cid) error

	// UpdateRigDeals sets the deals for the rig.
	UpdateRigDeals(ctx context.Context, rigID int, deals []Deal) error

	// TrackCid stores the IPFS cid for a label.
	TrackCid(ctx context.Context, label, cid string) error

	// TrackTableName records the table name for a chain id and label.
	TrackTableName(ctx context.Context, label string, chainID int64, name string) error

	// TrackTxn records a transaction.
	TrackTxn(
		ctx context.Context,
		hash string,
		tableLabel string,
		chainID int64,
		action string,
		sql string,
		gas int64,
		gasPrice int64,
	) error

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

	// Cid returns the stored layers cid.
	Cid(ctx context.Context, label string) (string, error)

	// Cids returns all tracked cids.
	Cids(ctx context.Context) ([]TrackedCid, error)

	// TableName returns the table name for the specified label and chain id.
	TableName(ctx context.Context, label string, chainID int64) (string, error)

	// TableNames returns all tracked tables for a chain id.
	TableNames(ctx context.Context, chainID int64) ([]TrackedTableName, error)

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

	// ClearTxns clears txn records.
	ClearTxns(ctx context.Context, tableLabel string, chainID int64, action string) error

	// Reset clears the db and starts fresh.
	Reset(ctx context.Context) error
}
