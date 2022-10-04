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
			value any not null,
			unique(rig_id, trait_type)
		)`,
	}
	// LookupsDefinition defines the cids table.
	LookupsDefinition = TableDefinition{
		Prefix: "lookups",
		Schema: `(
			label text primary key not null,
			value any not null
		)`,
	}
	// PilotSessionsDefinition defines the pilot sessions table.
	PilotSessionsDefinition = TableDefinition{
		Prefix: "pilot_sessions",
		Schema: `(
			id integer primary key,
  		rig_id integer not null,
  		pilot_contract text,
  		pilot_id integer,
  		start integer not null,
  		end integer
		)`,
	}
)

// Lookup holds a label and value.
type Lookup struct {
	Label string
	Value interface{}
}

// Store defines a data store interface for rigs.
type Store interface {
	CreateTable(context.Context, TableDefinition) (string, error)
	InsertParts(context.Context, []local.Part) error
	InsertLayers(context.Context, []local.Layer) error
	InsertRigAttributes(context.Context, []local.Rig) error
	InsertLookups(context.Context, []Lookup) error
	ClearParts(context.Context) error
	ClearLayers(context.Context) error
	ClearRigAttributes(context.Context) error
	ClearLookups(context.Context) error
	ClearPilotSessions(context.Context) error
}
