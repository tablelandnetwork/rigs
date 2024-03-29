package tableland

import (
	"context"

	"github.com/tablelandnetwork/rigs/pkg/storage/local"
)

// TableDefinition describes the definition of a table.
type TableDefinition struct {
	Prefix string
	Schema string
}

var (
	// PartsDefinition defines the parts table.
	PartsDefinition = TableDefinition{
		Prefix: "parts",
		Schema: `(
			id integer primary key,
			fleet text,
			original text,
			type text not null,
			name text not null,
			color text
		)`,
	}
	// LayersDefinition defines the layers table.
	LayersDefinition = TableDefinition{
		Prefix: "layers",
		Schema: `(
			id integer primary key,
			fleet text not null,
			rig_attributes_value text not null,
			position integer not null,
			path text not null,
			unique(fleet,rig_attributes_value,position)
		)`,
	}
	// RigsDefinition defines the rigs table.
	RigsDefinition = TableDefinition{
		Prefix: "rigs",
		Schema: `(
			id integer primary key,
			renders_cid text not null
		)`,
	}
	// RigAttributesDefinition defines the rig attribes table.
	RigAttributesDefinition = TableDefinition{
		Prefix: "rig_attributes",
		Schema: `(
			rig_id integer not null,
			display_type text,
			trait_type text not null,
			value text not null,
			unique(rig_id, trait_type)
		)`,
	}
	// DealsDefinition defines the deals table.
	DealsDefinition = TableDefinition{
		Prefix: "deals",
		Schema: `(
			rig_id integer not null,
			deal_id integer not null,
			storage_provider text not null,
			data_model_selector text not null,
			deal_number integer not null,
			primary key(rig_id, deal_id)
		)`,
	}
	// LookupsDefinition defines the lookups table.
	LookupsDefinition = TableDefinition{
		Prefix: "lookups",
		Schema: `(
			label text not null,
			value text not null
		)`,
	}
	// FtRewardsDefinition defines the ft rewards table.
	FtRewardsDefinition = TableDefinition{
		Prefix: "ft_rewards",
		Schema: `(
			id integer primary key,
			block_num integer not null,
			recipient text not null,
			reason text not null,
			amount integer not null,
			proposal_id integer
		)`,
	}
)

// Lookups holds values to be referenced in queries.
type Lookups struct {
	RendersCid           string
	LayersCid            string
	IndexCid             string
	ImageFullName        string
	ImageFullAlphaName   string
	ImageMediumName      string
	ImageMediumAlphaName string
	ImageThumbName       string
	ImageThumbAlphaName  string
	AnimationBaseURL     string
	FilecoinBaseURL      string
}

// Store defines a data store interface for rigs.
type Store interface {
	CreateTable(context.Context, TableDefinition) (string, error)
	InsertParts(context.Context, []local.Part) error
	InsertLayers(context.Context, []local.Layer) error
	InsertRigs(context.Context, []local.Rig) error
	InsertRigAttributes(context.Context, []local.Rig) error
	InsertDeals(context.Context, []local.Rig) error
	InsertLookups(context.Context, Lookups) error
	ClearParts(context.Context) error
	ClearLayers(context.Context) error
	ClearRigs(context.Context) error
	ClearRigAttributes(context.Context) error
	ClearDeals(context.Context) error
	ClearLookups(context.Context) error
}
