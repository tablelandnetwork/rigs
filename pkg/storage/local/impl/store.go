package impl

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"

	// Importing the SQLite driver.
	_ "github.com/mattn/go-sqlite3"

	// Import the SQLite dialect.
	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
)

const (
	createTablesSQL = `
		create table if not exists parts (
			id integer primary key,
			fleet text,
			original text,
			type text not null,
			name text not null,
			color text,
			unique(fleet,name,color)
		);

		create table if not exists layers (
			id integer primary key,
			fleet text not null,
			color text not null,
			part_name text not null,
			part_type text not null,
			position integer not null,
			path text not null,
			unique(fleet,color,part_name,position)
		);

		create table if not exists rigs (
			id integer primary key,
			original boolean,
			percent_original float,
			percent_original_50 float,
			percent_original_75 float,
			percent_original_90 float,
			vin text not null unique
		);
		
		create table if not exists rig_parts (
			rig_id integer not null,
			part_id integer not null,
			primary key(rig_id,part_id),
			foreign key (rig_id) references rigs (id)
			foreign key (part_id) references parts (id)
		);

		create table if not exists cids (
			label text primary key not null,
			cid text not null
		);

		create table if not exists table_names (
			label text not null,
			chain_id integer not null,
			name text not null,
			primary key (label, chain_id)
		);
	`
	clearInventorySQL = `
		delete from parts;
		delete from layers;
	`
	clearRigsSQL = `
		delete from rig_parts;
		delete from rigs;
	`
	dropTablesSQL = `
		drop table if exists parts;
		drop table if exists layers;
		drop table if exists rigs;
		drop table if exists rig_parts;
	`
)

// Store provides local data storage.
type Store struct {
	db *goqu.Database
}

// NewStore creates a new SQLite store.
func NewStore(ctx context.Context, db *sql.DB) (local.Store, error) {
	s := &Store{db: goqu.New("sqlite3", db)}
	if err := s.createTables(ctx); err != nil {
		return nil, fmt.Errorf("creating tables: %v", err)
	}
	return s, nil
}

// InsertParts inserts the Parts.
func (s *Store) InsertParts(ctx context.Context, parts []local.Part) error {
	var vals [][]interface{}
	for _, part := range parts {
		vals = append(vals, goqu.Vals{part.Fleet, part.Original, part.Type, part.Name, part.Color})
	}
	insert := s.db.Insert("parts").Cols("fleet", "original", "type", "name", "color").Vals(vals...).Executor()
	if _, err := insert.ExecContext(ctx); err != nil {
		return fmt.Errorf("inserting parts: %v", err)
	}
	return nil
}

// InsertLayers inserts Layers.
func (s *Store) InsertLayers(ctx context.Context, layers []local.Layer) error {
	var vals [][]interface{}
	for _, layer := range layers {
		vals = append(vals, goqu.Vals{layer.Fleet, layer.Color, layer.PartName, layer.PartType, layer.Position, layer.Path})
	}
	insert := s.db.Insert("layers").
		Cols("fleet", "color", "part_name", "part_type", "position", "Path").
		Vals(vals...).
		Executor()
	if _, err := insert.ExecContext(ctx); err != nil {
		return fmt.Errorf("inserting layers: %v", err)
	}
	return nil
}

// InsertRigs inserts Rigs and their Parts.
func (s *Store) InsertRigs(ctx context.Context, rigs []local.Rig) error {
	var rigVals [][]interface{}
	var partVals [][]interface{}
	for _, rig := range rigs {
		rigVals = append(rigVals, goqu.Vals{
			rig.ID,
			rig.Original,
			rig.PercentOriginal,
			rig.PercentOriginal50,
			rig.PercentOriginal75,
			rig.PercentOriginal90,
			rig.VIN,
		})
		for _, part := range rig.Parts {
			partVals = append(partVals, goqu.Vals{rig.ID, part.ID})
		}
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("starting tx: %v", err)
	}

	insertRigs := tx.Insert("rigs").Cols(
		"id", "original", "percent_original", "percent_original_50", "percent_original_75", "percent_original_90", "vin",
	).Vals(rigVals...).Executor()
	insertParts := tx.Insert("rig_parts").
		Cols("rig_id", "part_id").
		Vals(partVals...).
		Executor()

	if _, err = insertRigs.Exec(); err != nil {
		if rErr := tx.Rollback(); rErr != nil {
			return fmt.Errorf("rolling back tx: %v, inserting rigs: %v", rErr, err)
		}
		return fmt.Errorf("inserting rigs: %v", err)
	}

	if _, err = insertParts.Exec(); err != nil {
		if rErr := tx.Rollback(); rErr != nil {
			return fmt.Errorf("rolling back tx: %v, inserting parts: %v", rErr, err)
		}
		return fmt.Errorf("inserting parts: %v", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing tx: %v", err)
	}

	return nil
}

// TrackCid implements TrackCid.
func (s *Store) TrackCid(ctx context.Context, label, cid string) error {
	if _, err := s.db.ExecContext(
		ctx,
		"insert into cids (label, cid) values (?, ?) on conflict(label) do update set cid = ?",
		label,
		cid,
		cid,
	); err != nil {
		return fmt.Errorf("executing query: %v", err)
	}
	return nil
}

// TrackTableName implements TrackTableName.
func (s *Store) TrackTableName(ctx context.Context, label string, chainID int64, name string) error {
	if _, err := s.db.ExecContext(
		ctx,
		"insert into table_names (label, chain_id, name) values (?, ?, ?) on conflict (label, chain_id) do update set name = ?", // nolint
		label,
		chainID,
		name,
		name,
	); err != nil {
		return fmt.Errorf("executing query: %v", err)
	}
	return nil
}

// GetOriginalRigs gets a list of all OriginalRigs.
func (s *Store) GetOriginalRigs(ctx context.Context) ([]local.OriginalRig, error) {
	sel := s.db.Select("fleet", "original", "color").Distinct().
		From("parts").
		Where(
			goqu.C("fleet").IsNotNull(),
			goqu.C("original").IsNotNull(),
			goqu.C("color").IsNotNull(),
			goqu.C("original").Neq("Circuit Sled"),
		).Executor()

	var res []local.OriginalRig
	if err := sel.ScanStructsContext(ctx, &res); err != nil {
		return nil, fmt.Errorf("scanning original rig results: %v", err)
	}
	return res, nil
}

// GetPartTypesByFleet returns a list of party types for the specified fleet.
func (s *Store) GetPartTypesByFleet(ctx context.Context, fleet string) ([]string, error) {
	sel := s.db.Select("type").Distinct().
		From("parts").
		Where(goqu.C("fleet").Eq(fleet)).
		Executor()
	var res []string
	if err := sel.ScanValsContext(ctx, &res); err != nil {
		return nil, fmt.Errorf("scanning part types results: %v", err)
	}
	return res, nil
}

// Parts returns a list of parts filtered according to the provided options.
func (s *Store) Parts(ctx context.Context, opts ...local.PartsOption) ([]local.Part, error) {
	c := &local.PartsConfig{}
	for _, opt := range opts {
		opt(c)
	}

	q := s.db.Select("id", "fleet", "original", "type", "name", "color").From("parts")

	if c.Color != "" {
		q = q.Where(goqu.C("color").Eq(c.Color))
	}
	if c.Fleet != "" {
		q = q.Where(goqu.C("fleet").Eq(c.Fleet))
	}
	if c.Name != "" {
		q = q.Where(goqu.C("name").Eq(c.Name))
	}
	if c.Original != "" {
		q = q.Where(goqu.C("original").Eq(c.Original))
	}
	if c.PartType != "" {
		q = q.Where(goqu.C("type").Eq(c.PartType))
	}
	if c.OrderBy != "" {
		q = q.Order(goqu.C(c.OrderBy).Asc())
	}
	if c.Limit != nil {
		q = q.Limit(*c.Limit)
	}
	if c.Offset != nil {
		q = q.Offset(*c.Offset)
	}

	var parts []local.Part
	if err := q.ScanStructsContext(ctx, &parts); err != nil {
		return nil, fmt.Errorf("querying for parts: %v", err)
	}

	return parts, nil
}

// Layers returns a list of Layers for the specified fleet and part name/colors.
func (s *Store) Layers(ctx context.Context, opts ...local.LayersOption) ([]local.Layer, error) {
	c := local.LayersConfig{}
	for _, opt := range opts {
		opt(&c)
	}

	q := s.db.Select("*").From("layers")

	if c.Fleet != "" {
		q = q.Where(goqu.C("fleet").Eq(c.Fleet))
	}

	var ands []exp.Expression
	for _, part := range c.Parts {
		ands = append(ands, goqu.And(goqu.C("part_name").Eq(part.PartName), goqu.C("color").Eq(part.Color)))
	}
	q = q.Where(goqu.Or(ands...))

	if c.OrderBy != "" {
		q = q.Order(goqu.C(c.OrderBy).Asc())
	}
	if c.Limit != nil {
		q = q.Limit(*c.Limit)
	}
	if c.Offset != nil {
		q = q.Offset(*c.Offset)
	}

	var layers []local.Layer
	if err := q.ScanStructsContext(ctx, &layers); err != nil {
		return nil, fmt.Errorf("querying layers: %v", err)
	}
	return layers, nil
}

// Rigs returns a list of Rigs.
func (s *Store) Rigs(ctx context.Context, opts ...local.RigsOption) ([]local.Rig, error) {
	c := local.RigsConfig{}
	for _, opt := range opts {
		opt(&c)
	}

	q := s.db.Select("*").From("rigs")
	if c.Limit != nil {
		q = q.Limit(*c.Limit)
	}
	if c.Offset != nil {
		q = q.Offset(*c.Offset)
	}

	var rigs []local.Rig
	if err := q.ScanStructsContext(ctx, &rigs); err != nil {
		return nil, fmt.Errorf("querying rigs: %v", err)
	}
	for i := 0; i < len(rigs); i++ {
		q := s.db.Select("id", "fleet", "original", "type", "name", "color").
			From("rig_parts").
			Join(goqu.T("parts"), goqu.On(goqu.Ex{"rig_parts.part_id": goqu.I("parts.id")})).
			Where(goqu.C("rig_id").Eq(rigs[i].ID))
		var parts []local.Part
		if err := q.ScanStructsContext(ctx, &parts); err != nil {
			return nil, fmt.Errorf("querying parts for rig: %v", err)
		}
		rigs[i].Parts = parts
	}
	return rigs, nil
}

// Cid implements Cid.
func (s *Store) Cid(ctx context.Context, label string) (string, error) {
	sel := s.db.Select("cid").
		From("cids").
		Where(goqu.C("label").Eq(label)).
		Executor()
	var res string
	found, err := sel.ScanValContext(ctx, &res)
	if err != nil {
		return "", fmt.Errorf("scanning cid result: %v", err)
	}
	if !found {
		return "", errors.New("not found")
	}
	return res, nil
}

// Cids implements Cids.
func (s *Store) Cids(ctx context.Context) ([]local.TrackedCid, error) {
	q := s.db.Select("*").From("cids")
	var cids []local.TrackedCid
	if err := q.ScanStructsContext(ctx, &cids); err != nil {
		return nil, fmt.Errorf("querying cids: %v", err)
	}
	return cids, nil
}

// TableName implements TableName.
func (s *Store) TableName(ctx context.Context, label string, chainID int64) (string, error) {
	sel := s.db.Select("name").
		From("table_names").
		Where(goqu.C("label").Eq(label), goqu.C("chain_id").Eq(chainID)).
		Executor()
	var res string
	found, err := sel.ScanValContext(ctx, &res)
	if err != nil {
		return "", fmt.Errorf("scanning name result: %v", err)
	}
	if !found {
		return "", errors.New("not found")
	}
	return res, nil
}

// TableNames implements TableNames.
func (s *Store) TableNames(ctx context.Context, chainID int64) ([]local.TrackedTableName, error) {
	q := s.db.Select("*").From("table_names").Where(goqu.C("chain_id").Eq(chainID))
	var tableNames []local.TrackedTableName
	if err := q.ScanStructsContext(ctx, &tableNames); err != nil {
		return nil, fmt.Errorf("querying table names: %v", err)
	}
	return tableNames, nil
}

// Counts implements Counts.
func (s *Store) Counts(ctx context.Context) (local.Counts, error) {
	q := `
	select 
		sum(org) as originals,
		sum(rnd) as randoms from (
			select 
				case when original then 1 else 0 end  org,
				case when not original then 1 else 0 end rnd
			from rigs
		)
	`
	var counts local.Counts
	if _, err := s.db.ScanStruct(&counts, q); err != nil {
		return local.Counts{}, fmt.Errorf("scanning structs: %v", err)
	}
	return counts, nil
}

// FleetRankings implements FleetRankings.
func (s *Store) FleetRankings(ctx context.Context) ([]local.Ranking, error) {
	q := `
		select 
			name,
			count (*) as count,
			round(
				cast(count(*) * 100 as real) / (
					select count(*) 
					from rigs join rig_parts on rigs.id = rig_parts.rig_id join parts on rig_parts.part_id = parts.id 
					where type = 'Fleet' and not rigs.original
				),
				1
			) as percentage
		from rigs join rig_parts on rigs.id = rig_parts.rig_id join parts on rig_parts.part_id = parts.id
		where type = 'Fleet' and not rigs.original
		group by name
		order by percentage
	`
	var rankings []local.Ranking
	if err := s.db.ScanStructs(&rankings, q); err != nil {
		return nil, fmt.Errorf("scanning structs: %v", err)
	}
	return rankings, nil
}

// BackgroundColorRankings implements FleetRankings.
func (s *Store) BackgroundColorRankings(ctx context.Context) ([]local.Ranking, error) {
	q := `
	select 
		color as name,
		count (*) as count ,
		round(
			cast(count(*) * 100 as real) / (
				select count(*) 
				from rigs join rig_parts on rigs.id = rig_parts.rig_id join parts on rig_parts.part_id = parts.id 
				where type = 'Background'
			), 1
		) as percentage
	from rigs join rig_parts on rigs.id = rig_parts.rig_id join parts on rig_parts.part_id = parts.id
	where type = 'Background' and not rigs.original
	group by color
	order by percentage
	`
	var rankings []local.Ranking
	if err := s.db.ScanStructs(&rankings, q); err != nil {
		return nil, fmt.Errorf("scanning structs: %v", err)
	}
	return rankings, nil
}

// OriginalRankings implements OriginalRankings.
func (s *Store) OriginalRankings(ctx context.Context, fleet string) ([]local.Ranking, error) {
	q := `
		select 
			parts.original as name,
			count (*) as count ,
			round(
				cast(count(*) * 100 as real) / (
					select count(*) 
					from rigs join rig_parts on rigs.id = rig_parts.rig_id join parts on rig_parts.part_id = parts.id 
					where parts.original is not null and not rigs.original and fleet = ?
				), 1
			) as percentage
		from rigs join rig_parts on rigs.id = rig_parts.rig_id join parts on rig_parts.part_id = parts.id
		where parts.original is not null and not rigs.original and fleet = ?
		group by parts.original
		order by percentage
	`
	var rankings []local.Ranking
	if err := s.db.ScanStructs(&rankings, q, fleet, fleet); err != nil {
		return nil, fmt.Errorf("scanning structs: %v", err)
	}
	return rankings, nil
}

// ClearInventory implements ClearInventory.
func (s *Store) ClearInventory(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, clearInventorySQL); err != nil {
		return fmt.Errorf("executing sql: %v", err)
	}
	return nil
}

// ClearRigs implements ClearRigs.
func (s *Store) ClearRigs(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, clearRigsSQL); err != nil {
		return fmt.Errorf("executing sql: %v", err)
	}
	return nil
}

// Reset implements Reset.
func (s *Store) Reset(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, dropTablesSQL); err != nil {
		return fmt.Errorf("dropping tables: %v", err)
	}
	if err := s.createTables(ctx); err != nil {
		return fmt.Errorf("creating tables: %v", err)
	}
	return nil
}

func (s *Store) createTables(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, createTablesSQL); err != nil {
		return fmt.Errorf("executing sql: %v", err)
	}
	return nil
}
