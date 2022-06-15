package common

import (
	"fmt"
	"strings"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/tableland"

	// Import the SQLite driver.
	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
)

var dialect = goqu.Dialect("sqlite3")

const (
	// CreatePartsTableSQL is the SQL.
	CreatePartsTableSQL = `create table parts (
		fleet text,
		original text,
		type text not null,
		name text not null,
		color text,
		primary key(fleet,name,color)
	);`

	// CreateLayersTableSQL is the SQL.
	CreateLayersTableSQL = `create table layers (
		fleet text not null,
		part text not null,
		position integer not null,
		path text not null,
		primary key(fleet,part,position)
	);`

	// CreateRigsTableSQL is the SQL.
	CreateRigsTableSQL = `create table rigs (
		id integer primary key,
		image text
	);`

	// CreateRigAttributesTableSQL is the SQL.
	CreateRigAttributesTableSQL = `create table rig_attributes (
		rig_id integer,
		display_type text,
		trait_type text,
		value integer,
		primary key(rig_id, trait_type)
	);`
)

// SQLForInsertingParts returns the SQL statement.
func SQLForInsertingParts(parts []tableland.Part) (string, error) {
	var vals [][]interface{}
	for _, part := range parts {
		vals = append(vals, goqu.Vals{part.Fleet, part.Original, part.Type, part.Name, part.Color})
	}
	ds := dialect.Insert("parts").Cols("fleet", "original", "type", "name", "color").Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert parts: %v", err)
	}
	return sql, nil
}

// SQLForInsertingLayers returns the SQL statement.
func SQLForInsertingLayers(layers []tableland.Layer) string {
	b := new(strings.Builder)
	b.WriteString("insert into layers(fleet, part, position, path) values ")
	vals := []string{}
	for _, layer := range layers {
		vals = append(vals, fmt.Sprintf(
			"('%s','%s',%d,'%s')",
			layer.Fleet,
			layer.Part,
			layer.Position,
			layer.Path,
		))
	}
	b.WriteString(fmt.Sprintf("%s;", strings.Join(vals, ",")))
	return b.String()
}

// SQLForInsertingRigs returns the SQL statement.
func SQLForInsertingRigs(rigs []tableland.Rig) (string, error) {
	var rigVals [][]interface{}
	var attVales [][]interface{}
	for _, rig := range rigs {
		rigVals = append(rigVals, goqu.Vals{rig.ID, rig.Image})
		for _, att := range rig.Attributes {
			attVales = append(attVales, goqu.Vals{rig.ID, att.DisplayType, att.TraitType, att.Value})
		}
	}

	ds := dialect.Insert("rigs").Cols("id", "image").Vals(rigVals...)
	sql1, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert rigs: %v", err)
	}

	ds = dialect.Insert("rig_attributes").Cols("rig_id", "display_type", "trait_type", "value").Vals(attVales...)
	sql2, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert rig attributes: %v", err)
	}

	return strings.Join([]string{sql1, sql2}, ";\n"), nil
}

// SQLForGettingOriginalRigs returns the SQL statement.
func SQLForGettingOriginalRigs() string {
	return `select distinct
		fleet, original, color
		from parts
		where fleet is not null and original is not null and color is not null and original != 'Circuit Sled'`
}

// SQLForGettingPartTypesByFleet returns the SQL statement.
func SQLForGettingPartTypesByFleet(fleet string) string {
	return fmt.Sprintf("select distinct type from parts where fleet = '%s'", fleet)
}

// SQLForGettingParts returns the SQL statement.
func SQLForGettingParts(options *tableland.GetPartsConfig) string {
	b := new(strings.Builder)
	b.WriteString("select * from parts")
	var wheres []string
	if len(options.Color) > 0 {
		wheres = append(wheres, fmt.Sprintf("color = '%s'", options.Color))
	}
	if len(options.Fleet) > 0 {
		wheres = append(wheres, fmt.Sprintf("fleet = '%s'", options.Fleet))
	}
	if len(options.Name) > 0 {
		wheres = append(wheres, fmt.Sprintf("name = '%s'", options.Name))
	}
	if len(options.Original) > 0 {
		wheres = append(wheres, fmt.Sprintf("original = '%s'", options.Original))
	}
	if len(options.Type) > 0 {
		wheres = append(wheres, fmt.Sprintf("type = '%s'", options.Type))
	}
	if len(wheres) > 0 {
		b.WriteString(fmt.Sprintf(" where %s", strings.Join(wheres, " and ")))
	}
	if len(options.OrderBy) > 0 {
		b.WriteString(fmt.Sprintf(" order by %s", options.OrderBy))
	}
	b.WriteString(";")
	return b.String()
}

// SQLForGettingLayers returns the SQL statement.
func SQLForGettingLayers(fleet string, parts []string) string {
	var partsExp []string
	for _, part := range parts {
		partsExp = append(partsExp, fmt.Sprintf("part = '%s'", part))
	}
	b := new(strings.Builder)
	b.WriteString(fmt.Sprintf("select * from layers where fleet = '%s' and (", fleet))
	b.WriteString(strings.Join(partsExp, " or "))
	b.WriteString(") order by position;")
	return b.String()
}
