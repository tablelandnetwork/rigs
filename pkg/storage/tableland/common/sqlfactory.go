package common

import (
	"errors"
	"fmt"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"

	// Import the SQLite driver.
	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
)

// SQLFactory create SQL from structs.
type SQLFactory struct {
	d goqu.DialectWrapper
}

// NewSQLFactory creates a new SQLFactory.
func NewSQLFactory(dialect goqu.DialectWrapper) *SQLFactory {
	return &SQLFactory{d: dialect}
}

// SQLForInsertingParts returns the SQL statement.
func (s *SQLFactory) SQLForInsertingParts(table string, parts []local.Part) (string, error) {
	var vals [][]interface{}
	for _, part := range parts {
		vals = append(vals, goqu.Vals{part.ID, part.Fleet, part.Original, part.Type, part.Name, part.Color})
	}
	ds := s.d.Insert(table).Cols("id", "fleet", "original", "type", "name", "color").Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert parts: %v", err)
	}
	return sql, nil
}

// SQLForInsertingLayers returns the SQL statement.
func (s *SQLFactory) SQLForInsertingLayers(table string, layers []local.Layer) (string, error) {
	var vals [][]interface{}
	for _, layer := range layers {
		coloredPart := fmt.Sprintf("%s %s", layer.Color, layer.PartName)
		vals = append(vals, goqu.Vals{layer.ID, layer.Fleet, coloredPart, layer.Position, layer.Path})
	}
	ds := s.d.Insert(table).Cols("id", "fleet", "rig_attributes_value", "position", "path").Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert parts: %v", err)
	}
	return sql, nil
}

// SQLForInsertingRigs returns the SQL statement.
func (s *SQLFactory) SQLForInsertingRigs(rigsTable string, rigs []local.Rig) (string, error) {
	var rigVals [][]interface{}
	for _, rig := range rigs {
		rigVals = append(rigVals, goqu.Vals{rig.ID, rig.Image})
	}

	ds := s.d.Insert(rigsTable).Cols("id", "image").Vals(rigVals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert rigs: %v", err)
	}

	return sql, nil
}

// SQLForInsertingRigAttributes returns the SQL statement.
func (s *SQLFactory) SQLForInsertingRigAttributes(rigAttrTable string, rigs []local.Rig) (string, error) {
	var attVales [][]interface{}
	for _, rig := range rigs {
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

	ds := s.d.Insert(rigAttrTable).Cols("rig_id", "display_type", "trait_type", "value").Vals(attVales...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert rig attributes: %v", err)
	}

	return sql, nil
}

// SQLForClearingData returns the SQL statement.
func (s *SQLFactory) SQLForClearingData(tableName string) (string, error) {
	ds := s.d.Delete(tableName)

	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating delete sql: %v", err)
	}
	return sql, nil
}
