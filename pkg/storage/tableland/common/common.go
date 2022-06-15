package common

import (
	"errors"
	"fmt"
	"strings"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"

	// Import the SQLite driver.
	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
)

var dialect = goqu.Dialect("sqlite3")

// SQLForInsertingParts returns the SQL statement.
func SQLForInsertingParts(parts []local.Part) (string, error) {
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
func SQLForInsertingLayers(layers []local.Layer) (string, error) {
	var vals [][]interface{}
	for _, layer := range layers {
		coloredPart := fmt.Sprintf("%s %s", layer.Color, layer.PartName)
		vals = append(vals, goqu.Vals{layer.Fleet, coloredPart, layer.Position, layer.Path})
	}
	ds := dialect.Insert("layers").Cols("fleet", "rig_attribute_value", "position", "path").Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert parts: %v", err)
	}
	return sql, nil
}

// SQLForInsertingRigs returns the SQL statement.
func SQLForInsertingRigs(rigs []local.Rig) (string, error) {
	var rigVals [][]interface{}
	var attVales [][]interface{}
	for _, rig := range rigs {
		rigVals = append(rigVals, goqu.Vals{rig.ID, rig.Image})
		if rig.Original {
			if len(rig.Parts) == 0 {
				return "", errors.New("no parts for getting original rig color and original")
			}
			original := rig.Parts[0].Original
			color := rig.Parts[0].Color
			attVales = append(
				attVales,
				goqu.Vals{rig.ID, "text", "Name", original},
				goqu.Vals{rig.ID, "text", "Color", color},
			)
		}
		attVales = append(attVales, goqu.Vals{rig.ID, "text", "Percent Original", fmt.Sprintf("%f", rig.PercentOriginal)})
		for _, part := range rig.Parts {
			attVales = append(attVales, goqu.Vals{rig.ID, "text", part.Type, part.Name})
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
