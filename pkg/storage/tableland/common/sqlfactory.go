package common

import (
	"errors"
	"fmt"
	"strings"

	"github.com/doug-martin/goqu/v9"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
	"github.com/tablelandnetwork/rigs/pkg/storage/tableland"

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
func (s *SQLFactory) SQLForInsertingLayers(table string, layers []local.Layer) (string, error) {
	var vals [][]interface{}
	for _, layer := range layers {
		coloredPart := fmt.Sprintf("%s %s", layer.Color, layer.PartName)
		vals = append(
			vals,
			goqu.Vals{layer.ID, layer.Fleet, coloredPart, layer.Position, layer.Path},
		)
	}
	ds := s.d.Insert(table).Cols("id", "fleet", "rig_attributes_value", "position", "path").Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert parts: %v", err)
	}
	return clean(sql), nil
}

// SQLForInsertingRigs retutns the SQL statement.
func (s *SQLFactory) SQLForInsertingRigs(table string, rigs []local.Rig) (string, error) {
	var vals [][]interface{}
	for _, rig := range rigs {
		vals = append(
			vals,
			goqu.Vals{rig.ID, rig.RendersCid},
		)
	}
	ds := s.d.Insert(table).Cols("id", "renders_cid").Vals(vals...)
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
			goqu.Vals{
				rig.ID,
				"number",
				"% Original",
				strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", rig.PercentOriginal90*100), "0"), "."),
			},
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

// SQLForInsertingDeals returns the SQL statement.
func (s *SQLFactory) SQLForInsertingDeals(table string, rigs []local.Rig) (string, error) {
	var vals [][]interface{}
	for _, rig := range rigs {
		for i, deal := range rig.Deals {
			vals = append(
				vals,
				goqu.Vals{rig.ID, deal.DealID, deal.StorageProvider, deal.DataModelSelector, i + 1},
			)
		}
	}
	ds := s.d.Insert(table).
		Cols("rig_id", "deal_id", "storage_provider", "data_model_selector", "deal_number").
		Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert deals: %v", err)
	}
	return clean(sql), nil
}

// SQLForInsertingLookups returns the SQL statement.
func (s *SQLFactory) SQLForInsertingLookups(lookupsTable string, lookups tableland.Lookups) (string, error) {
	vals := [][]interface{}{
		{
			"renders_cid", lookups.RendersCid,
		},
		{
			"layers_cid", lookups.LayersCid,
		},
		{
			"index_cid", lookups.IndexCid,
		},
		{
			"image_full_name", lookups.ImageFullName,
		},
		{
			"image_full_alpha_name", lookups.ImageFullAlphaName,
		},
		{
			"image_medium_name", lookups.ImageMediumName,
		},
		{
			"image_medium_alpha_name", lookups.ImageMediumAlphaName,
		},
		{
			"image_thumb_name", lookups.ImageThumbName,
		},
		{
			"image_thumb_alpha_name", lookups.ImageThumbAlphaName,
		},
		{
			"animation_base_url", lookups.AnimationBaseURL,
		},
		{
			"filecoin_base_url", lookups.FilecoinBaseURL,
		},
	}
	ds := s.d.Insert(lookupsTable).Cols(
		"label",
		"value",
	).Vals(vals...)
	sql, _, err := ds.ToSQL()
	if err != nil {
		return "", fmt.Errorf("creating sql to insert lookups: %v", err)
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
