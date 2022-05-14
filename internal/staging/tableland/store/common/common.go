package common

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
)

const (
	CreatePartsTableSQL = `create table parts (
		fleet text,
		original text,
		type text not null,
		name text not null,
		color text,
		rank integer,
		primary key(fleet,name,color)
	);`

	CreateLayersTableSQL = `create table layers (
		fleet text not null,
		part_name text not null,
		part_color text not null,
		position integer not null,
		path text not null,
		primary key(fleet,part_name,part_color,position)
	);`

	CreateDistributionsTableSQL = `create table distributions (
		fleet text,
		part_type text not null,
		distribution text not null,
		primary key(fleet, part_type)
	);`
)

func SqlForInsertingParts(parts []store.Part) string {
	b := new(strings.Builder)
	b.WriteString("insert into parts(fleet, original, type, name, color, rank) values ")
	vals := []string{}
	for _, part := range parts {
		vals = append(vals, fmt.Sprintf(
			"(%s,%s,'%s','%s',%s,%s)",
			nullableStringValue(part.Fleet),
			nullableStringValue(part.Original),
			part.Type,
			part.Name,
			nullableStringValue(part.Color),
			nullableInt16Value(part.Rank),
		))
	}
	b.WriteString(fmt.Sprintf("%s;", strings.Join(vals, ",")))
	return b.String()
}

func SqlForInsertingPart(part store.Part) string {
	return fmt.Sprintf(
		"insert into parts(fleet, original, type, name, color, rank) values (%s,%s,'%s','%s',%s,%s);",
		nullableStringValue(part.Fleet),
		nullableStringValue(part.Original),
		part.Type,
		part.Name,
		nullableStringValue(part.Color),
		nullableInt16Value(part.Rank),
	)
}

func SqlForInsertingLayers(layers []store.Layer) string {
	b := new(strings.Builder)
	b.WriteString("insert into layers(fleet, part_name, part_color, position, path) values ")
	vals := []string{}
	for _, layer := range layers {
		vals = append(vals, fmt.Sprintf(
			"('%s','%s','%s',%d,'%s')",
			layer.Fleet,
			layer.PartName,
			layer.PartColor,
			layer.Position,
			layer.Path,
		))
	}
	b.WriteString(fmt.Sprintf("%s;", strings.Join(vals, ",")))
	return b.String()
}

func SqlForInsertingLayer(layer store.Layer) string {
	return fmt.Sprintf(
		"insert into layers(fleet, part_name, part_color, position, path) values ('%s','%s','%s',%d,'%s');",
		layer.Fleet,
		layer.PartName,
		layer.PartColor,
		layer.Position,
		layer.Path,
	)
}

func SqlForInsertingDistributions(dists []store.Distribution) string {
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

func SqlForInsertingDistribution(dist store.Distribution) string {
	return fmt.Sprintf(
		"insert into layers(insert into distributions(fleet, part_type, distribution) values (%s,'%s','%s');",
		nullableStringValue(dist.Fleet),
		dist.PartType,
		dist.Distribution,
	)
}

func SQLForGettingParts(options *store.GetPartsOptions) string {
	// TODO: Build the reql query.
	return "select * from parts"
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
