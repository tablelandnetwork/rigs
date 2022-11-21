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
	// LookupsDefinition defines the lookups table.
	LookupsDefinition = TableDefinition{
		Prefix: "lookups",
		Schema: `(
			renders_cid text,
			layers_cid text,
			image_full_name text,
			image_full_alpha_name text,
			image_medium_name text,
			image_medium_alpha_name text,
			image_thumb_name text,
			image_thumb_alpha_name text,
			animation_base_url text
		)`,
	}
)

// Lookups holds values to be referenced in queries.
type Lookups struct {
	RendersCid           string
	LayersCid            string
	ImageFullName        string
	ImageFullAlphaName   string
	ImageMediumName      string
	ImageMediumAlphaName string
	ImageThumbName       string
	ImageThumbAlphaName  string
	AnimationBaseURL     string
}

// Store defines a data store interface for rigs.
type Store interface {
	CreateTable(context.Context, TableDefinition) (string, error)
	InsertParts(context.Context, []local.Part) error
	InsertLayers(context.Context, []local.Layer) error
	InsertRigAttributes(context.Context, []local.Rig) error
	InsertLookups(context.Context, Lookups) error
	ClearParts(context.Context) error
	ClearLayers(context.Context) error
	ClearRigAttributes(context.Context) error
	ClearLookups(context.Context) error
}
