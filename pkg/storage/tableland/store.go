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
			cid text not null,
			unique(fleet,rig_attributes_value,position)
		)`,
	}
	// RigsDefinition defines the rigs table.
	RigsDefinition = TableDefinition{
		Prefix: "rigs",
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
	RigAttributesDefinition = TableDefinition{
		Prefix: "rig_attributes",
		Schema: `(
			rig_id integer not null,
			display_type text,
			trait_type text not null,
			value any not null,
			unique(rig_id, trait_type)
		)`,
	}
)

// Store defines a data store interface for rigs.
type Store interface {
	CreateTable(context.Context, TableDefinition) (string, error)
	InsertParts(context.Context, []local.Part) error
	InsertLayers(context.Context, []local.Layer) error
	InsertRigs(context.Context, string, string, []local.Rig) error
	InsertRigAttributes(context.Context, []local.Rig) error
	ClearPartsData(context.Context) error
	ClearLayersData(context.Context) error
	ClearRigsData(context.Context) error
	ClearRigAttributesData(context.Context) error
}
