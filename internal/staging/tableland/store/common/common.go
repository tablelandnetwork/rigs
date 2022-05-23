package common

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
)

const (
	// CreatePartsTableSQL is the SQL.
	CreatePartsTableSQL = `create table parts (
		fleet text,
		original text,
		type text not null,
		name text not null,
		color text,
		rank integer,
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

	// CreateDistributionsTableSQL is the SQL.
	CreateDistributionsTableSQL = `create table distributions (
		fleet text,
		part_type text not null,
		distribution text not null,
		primary key(fleet, part_type)
	);`

	// CreateRigsTableSQL is the SQL.
	CreateRigsTableSQL = `create table rigs (
		id integer primary key,
		image text
	);`

	// CreateRigAttributesTableSQL is the SQL.
	CreateRigAttributesTableSQL = `create table rig_attributes (
		rig_id,
		display_type text,
		trait_type text,
		value integer,
		primary key(id, trait_type)
	);`
)

// SQLForInsertingParts returns the SQL statement.
func SQLForInsertingParts(parts []store.Part) string {
	b := new(strings.Builder)
	b.WriteString("insert into parts(fleet, original, type, name, color, rank) values ")
	vals := []string{}
	for _, part := range parts {
		vals = append(vals, fmt.Sprintf(
			"(%s,%s,'%s','%s',%s,%d)",
			nullableStringValue(part.Fleet),
			nullableStringValue(part.Original),
			part.Type,
			part.Name,
			nullableStringValue(part.Color),
			part.Rank,
		))
	}
	b.WriteString(fmt.Sprintf("%s;", strings.Join(vals, ",")))
	return b.String()
}

// SQLForInsertingLayers returns the SQL statement.
func SQLForInsertingLayers(layers []store.Layer) string {
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

// SQLForInsertingDistributions returns the SQL statement.
func SQLForInsertingDistributions(dists []store.Distribution) string {
	b := new(strings.Builder)
	b.WriteString("insert into distributions(fleet, part_type, distribution) values ")
	vals := []string{}
	for _, dist := range dists {
		vals = append(vals, fmt.Sprintf(
			"(%s,'%s','%s')",
			nullableStringValue(dist.Fleet),
			dist.PartType,
			dist.Distribution,
		))
	}
	b.WriteString(fmt.Sprintf("%s;", strings.Join(vals, ",")))
	return b.String()
}

func SQLForInsertingRig(rig store.Rig) string {
	b := new(strings.Builder)
	b.WriteString(fmt.Sprintf("insert into rigs(id, imgage) values (%d, '%s');", rig.ID, rig.Image))
	b.WriteString("insert into rig_attributes(rig_id, display_type, trait_type, value) values ")
	vals := []string{}
	for _, att := range rig.Attributes {
		vals = append(vals, fmt.Sprintf(
			"(%s,'%s','%s')",
			nullableStringValue(att.DisplayType),
			att.TraitType,
			att.Value,
		))
	}
	b.WriteString(fmt.Sprintf("%s;", strings.Join(vals, ",")))
	return b.String()
}

// SQLForGettingPartTypesByFleet returns the SQL statement.
func SQLForGettingPartTypesByFleet(fleet string) string {
	return fmt.Sprintf("select distinct type from parts where fleet = '%s'", fleet)
}

// SQLForGettingPartTypeDistributionForFleets returns the SQL statement.
func SQLForGettingPartTypeDistributionForFleets() string {
	return "select distribution from distributions where part_type = 'Fleet'"
}

// SQLForGettingPartTypeDistributionsByFleet returns the SQL statement.
func SQLForGettingPartTypeDistributionsByFleet(fleet string) string {
	return fmt.Sprintf("select * from distributions where fleet = '%s'", fleet)
}

// SQLForGettingParts returns the SQL statement.
func SQLForGettingParts(options *store.GetPartsOptions) string {
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

func nullableStringValue(s store.NullableString) string {
	if s.Valid {
		return fmt.Sprintf("'%s'", s.String)
	}
	return "NULL"
}

func nullableInt16Value(s store.NullableInt16) string {
	if s.Valid {
		return strconv.Itoa(int(s.Int16))
	}
	return "NULL"
}
