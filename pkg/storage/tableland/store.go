package tableland

import (
	"context"

	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

// TableDefinition describes the definition of a table.
type TableDefinition struct {
	Prefix string
	Schema string
}

var (
	// PartsDefinition defines the parts table.
	PartsDefinition = TableDefinition{
		Prefix: "test_parts",
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
		Prefix: "test_layers",
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
		Prefix: "test_rigs",
		Schema: `(
			id integer primary key,
			image text,
			image_alpha text,
			thumb text,
			thumb_alpha text,
			animation_url text
		)`,
	}
	// RigAttributesDefinition defines the rig attribes table.
	// TODO: Switch this to ANY type for value once we switch to SQLite.
	RigAttributesDefinition = TableDefinition{
		Prefix: "test_rig_attributes",
		Schema: `(
			rig_id integer,
			display_type text,
			trait_type text,
			value text,
			primary key(rig_id, trait_type)
		)`,
	}
)

// Store defines a data store interface for rigs.
type Store interface {
	CreateTable(context.Context, TableDefinition) (string, error)
	InsertParts(context.Context, []local.Part) error
	InsertLayers(context.Context, []local.Layer) error
	InsertRigs(context.Context, string, []local.Rig) error
	InsertRigAttributes(context.Context, []local.Rig) error
	ClearPartsData(context.Context) error
	ClearLayersData(context.Context) error
	ClearRigsData(context.Context) error
	ClearRigAttributesData(context.Context) error
}
