package common

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"

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
	return clean(sql), nil
}

// SQLForInsertingLayers returns the SQL statement.
func (s *SQLFactory) SQLForInsertingLayers(table string, cid string, layers []local.Layer) (string, error) {
	var vals [][]interface{}
	for _, layer := range layers {
		coloredPart := fmt.Sprintf("%s %s", layer.Color, layer.PartName)
		vals = append(
			vals,
			goqu.Vals{layer.ID, layer.Fleet, coloredPart, layer.Position, fmt.Sprintf("ipfs://%s/%s", cid, layer.Path)},
		)
	}
	ds := s.d.Insert(table).Cols("id", "fleet", "rig_attributes_value", "position", "cid").Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert parts: %v", err)
	}
	return clean(sql), nil
}

// SQLForInsertingRigs returns the SQL statement.
func (s *SQLFactory) SQLForInsertingRigs(rigsTable, cid string, rigs []local.Rig) (string, error) {
	var rigVals [][]interface{}
	for _, rig := range rigs {
		rigVals = append(rigVals, goqu.Vals{
			rig.ID,
			fmt.Sprintf("ipfs://%s/%d/image.png", cid, rig.ID),
			fmt.Sprintf("ipfs://%s/%d/image_alpha.png", cid, rig.ID),
			fmt.Sprintf("ipfs://%s/%d/thumb.png", cid, rig.ID),
			fmt.Sprintf("ipfs://%s/%d/thumb_alpha.png", cid, rig.ID),
		})
	}

	ds := s.d.Insert(rigsTable).Cols("id", "image", "image_alpha", "thumb", "thumb_alpha").Vals(rigVals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert rigs: %v", err)
	}

	return clean(sql), nil
}

// SQLForInsertingRigAttributes returns the SQL statement.
func (s *SQLFactory) SQLForInsertingRigAttributes(rigAttrTable string, rigs []local.Rig) (string, error) {
	firstOriginalAndColor := func(parts []local.Part) (string, string, error) {
		for _, part := range parts {
			if part.Original.Valid && part.Color.Valid {
				return part.Original.String, part.Color.String, nil
			}
		}
		return "", "", errors.New("couldn't find part with original and color")
	}
	var attVales [][]interface{}
	for _, rig := range rigs {
		attVales = append(
			attVales,
			goqu.Vals{rig.ID, "string", "VIN", rig.VIN},
			goqu.Vals{rig.ID, "number", "% Original", math.Round((rig.PercentOriginal90*100)*100) / 100},
		)
		if rig.Original {
			if len(rig.Parts) == 0 {
				return "", errors.New("no parts for getting original rig color and original")
			}
			original, color, err := firstOriginalAndColor(rig.Parts)
			if err != nil {
				return "", fmt.Errorf("getting original and color: %v", err)
			}
			attVales = append(
				attVales,
				goqu.Vals{rig.ID, "string", "Name", original},
				goqu.Vals{rig.ID, "string", "Color", color},
			)
		}
		for _, part := range rig.Parts {
			b := strings.Builder{}
			if part.Color.Valid {
				b.WriteString(fmt.Sprintf("%s ", part.Color.String))
			}
			b.WriteString(part.Name)
			attVales = append(attVales, goqu.Vals{rig.ID, "string", part.Type, b.String()})
		}
	}

	ds := s.d.Insert(rigAttrTable).Cols("rig_id", "display_type", "trait_type", "value").Vals(attVales...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert rig attributes: %v", err)
	}

	return clean(sql), nil
}

// SQLForClearingData returns the SQL statement.
func (s *SQLFactory) SQLForClearingData(tableName string) (string, error) {
	ds := s.d.Delete(tableName)

	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating delete sql: %v", err)
	}
	return clean(sql), nil
}

func clean(sql string) string {
	return strings.ReplaceAll(sql, "`", "")
}
