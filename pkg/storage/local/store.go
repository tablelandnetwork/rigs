package local

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/doug-martin/goqu/v9"
	"github.com/doug-martin/goqu/v9/exp"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/common"

	// Importing the SQLite driver.
	_ "github.com/mattn/go-sqlite3"

	// Import the SQLite dialect.
	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
)

const (
	createPartsSQL = `create table parts (
		id integer primary key,
		fleet text,
		original text,
		type text not null,
		name text not null,
		color text,
		unique(fleet,name,color)
	)`

	createLayersSQL = `create table layers (
		id integer primary key,
		fleet text not null,
		color text not null,
		part_name text not null,
		part_type text not null,
		position integer not null,
		path text not null,
		unique(fleet,color,part_name,position)
	)`

	createRigsSQL = `create table rigs (
		id integer primary key,
		gateway text,
		images text,
		image text,
		image_alpha text,
		thumb text,
		thumb_alpha text,
		original boolean,
		percent_original float,
		percent_original_50 float,
		percent_original_75 float,
		percent_original_90 float
	)`

	createRigPartsSQL = `create table rig_parts (
		rig_id integer not null,
		part_id integer not null,
		primary key(rig_id,part_id),
		foreign key (rig_id) references rigs (id)
		foreign key (part_id) references parts (id)
	)`

	createRigImagesSQL = `create table rig_images (
		rig_id integer not null,
		ipfs_path text not null,
		foreign key (rig_id) references rigs (id)
	)`
)

// Part describes a rig part.
type Part struct {
	ID       uint                  `json:"id"`
	Fleet    common.NullableString `json:"fleet"`
	Original common.NullableString `json:"original"`
	Type     string                `json:"type"`
	Name     string                `json:"name"`
	Color    common.NullableString `json:"color"`
}

// Layer describes an image layer used for rendering a rig.
type Layer struct {
	ID       uint   `json:"id"`
	Fleet    string `json:"fleet"`
	Color    string `json:"color"`
	PartName string `json:"part_name" db:"part_name"`
	PartType string `json:"part_type" db:"part_type"`
	Position uint   `json:"position"`
	Path     string `json:"path"`
}

// Rig represents a generated rig.
type Rig struct {
	ID                int     `json:"id"`
	Gateway           string  `json:"gateway"`
	Images            string  `json:"images"`
	Image             string  `json:"image"`
	ImageAlpha        string  `json:"image_alpha" db:"image_alpha"`
	Thumb             string  `json:"thumb"`
	ThumbAlpha        string  `json:"thumb_alpha" db:"thumb_alpha"`
	Original          bool    `json:"original"`
	PercentOriginal   float64 `json:"percent_original" db:"percent_original"`
	PercentOriginal50 float64 `json:"percent_original_50" db:"percent_original_50"`
	PercentOriginal75 float64 `json:"percent_original_75" db:"percent_original_75"`
	PercentOriginal90 float64 `json:"percent_original_90" db:"percent_original_90"`
	Parts             []Part  `json:"parts"`
}

// OriginalRig represents an original rig.
type OriginalRig struct {
	Fleet string `json:"fleet"`
	Name  string `json:"name" db:"original"`
	Color string `json:"color"`
}

// Store provides local data storage.
type Store struct {
	db    *goqu.Database
	sqlDb *sql.DB
}

// TODO: When querying for Rigs, be sure to join rig_parts to parts to get all the properties.

// NewStore creates a new SQLite store.
func NewStore(dbFile string, reset bool) (*Store, error) {
	if reset {
		_ = os.Remove(dbFile)
	}
	db, err := sql.Open("sqlite3", dbFile)
	if err != nil {
		return nil, fmt.Errorf("opening db: %v", err)
	}

	return &Store{
		db:    goqu.New("sqlite3", db),
		sqlDb: db,
	}, nil
}

// CreateTables creates all the tables.
func (s *Store) CreateTables(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, createPartsSQL); err != nil {
		return fmt.Errorf("creating parts table: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, createLayersSQL); err != nil {
		return fmt.Errorf("creating layers table: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, createRigsSQL); err != nil {
		return fmt.Errorf("creating rigs table: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, createRigPartsSQL); err != nil {
		return fmt.Errorf("creating rig parts table: %v", err)
	}
	if _, err := s.db.ExecContext(ctx, createRigImagesSQL); err != nil {
		return fmt.Errorf("creating rig images table: %v", err)
	}
	return nil
}

// InsertParts inserts the Parts.
func (s *Store) InsertParts(ctx context.Context, parts []Part) error {
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
func (s *Store) InsertLayers(ctx context.Context, layers []Layer) error {
	var vals [][]interface{}
	for _, layer := range layers {
		vals = append(vals, goqu.Vals{layer.Fleet, layer.Color, layer.PartName, layer.PartType, layer.Position, layer.Path})
	}
	insert := s.db.Insert("layers").
		Cols("fleet", "color", "part_name", "part_type", "position", "path").
		Vals(vals...).
		Executor()
	if _, err := insert.ExecContext(ctx); err != nil {
		return fmt.Errorf("inserting layers: %v", err)
	}
	return nil
}

// InsertRigs inserts Rigs and their Parts.
func (s *Store) InsertRigs(ctx context.Context, rigs []Rig) error {
	var rigVals [][]interface{}
	var partVals [][]interface{}
	for _, rig := range rigs {
		rigVals = append(rigVals, goqu.Vals{
			rig.ID,
			rig.Gateway,
			rig.Images,
			rig.Image,
			rig.ImageAlpha,
			rig.Thumb,
			rig.ThumbAlpha,
			rig.Original,
			rig.PercentOriginal,
			rig.PercentOriginal50,
			rig.PercentOriginal75,
			rig.PercentOriginal90,
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
		"id", "gateway", "images", "image", "image_alpha", "thumb", "thumb_alpha", "original",
		"percent_original", "percent_original_50", "percent_original_75", "percent_original_90",
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

// RigImage associates a rig with its image on IPFS.
type RigImage struct {
	RigID    int
	IpfsPath string
}

// InsertRigImages inserts RigImgaes.
func (s *Store) InsertRigImages(ctx context.Context, rigImages []RigImage) error {
	var vals [][]interface{}
	for _, rigImage := range rigImages {
		vals = append(vals, goqu.Vals{rigImage.RigID, rigImage.IpfsPath})
	}
	insert := s.db.Insert("rig_images").Cols("rig_id", "ipfs_path").Vals(vals...).Executor()
	if _, err := insert.ExecContext(ctx); err != nil {
		return fmt.Errorf("inserting rig images: %v", err)
	}
	return nil
}

// ImageForRig returns the ipfs path for the rig id.
func (s *Store) ImageForRig(ctx context.Context, rigID string) (string, error) {
	sel := s.db.Select("ipfs_path").From("rig_images").Where(goqu.C("rig_id").Eq(rigID))
	var path string
	found, err := sel.ScanValContext(ctx, &path)
	if err != nil {
		return "", fmt.Errorf("querying for image for rig id: %v", err)
	}
	if !found {
		return "", fmt.Errorf("no image found for rig id %s", rigID)
	}
	return path, nil
}

// GetOriginalRigs gets a list of all OriginalRigs.
func (s *Store) GetOriginalRigs(ctx context.Context) ([]OriginalRig, error) {
	sel := s.db.Select("fleet", "original", "color").Distinct().
		From("parts").
		Where(
			goqu.C("fleet").IsNotNull(),
			goqu.C("original").IsNotNull(),
			goqu.C("color").IsNotNull(),
			goqu.C("original").Neq("Circuit Sled"),
		).Executor()

	var res []OriginalRig
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

// partsConfig holds configuration calls to Parts.
type partsConfig struct {
	fleet    string
	original string
	partType string
	name     string
	color    string
	orderBy  string
	limit    *uint
	offset   *uint
}

// PartsOption controls the behavior of Parts.
type PartsOption func(*partsConfig)

// PartsOfFleet filters resusts to the specified fleet.
func PartsOfFleet(fleet string) PartsOption {
	return func(opts *partsConfig) {
		opts.fleet = fleet
	}
}

// PartsOfOriginal filters resusts to the specified original.
func PartsOfOriginal(original string) PartsOption {
	return func(opts *partsConfig) {
		opts.original = original
	}
}

// PartsOfType filters resusts to the specified type.
func PartsOfType(t string) PartsOption {
	return func(opts *partsConfig) {
		opts.partType = t
	}
}

// PartsOfName filters resusts to the specified name.
func PartsOfName(name string) PartsOption {
	return func(opts *partsConfig) {
		opts.name = name
	}
}

// PartsOfColor filters resusts to the specified color.
func PartsOfColor(color string) PartsOption {
	return func(opts *partsConfig) {
		opts.color = color
	}
}

// OrderPartsBy orders results by the specified column asc.
func OrderPartsBy(orderBy string) PartsOption {
	return func(opts *partsConfig) {
		opts.orderBy = orderBy
	}
}

// PartsWithLimit limits the number of results returned.
func PartsWithLimit(limit uint) PartsOption {
	return func(pc *partsConfig) {
		pc.limit = &limit
	}
}

// PartsWithOffset offsets the beginning of the results returned.
func PartsWithOffset(offset uint) PartsOption {
	return func(pc *partsConfig) {
		pc.offset = &offset
	}
}

// Parts returns a list of parts filtered according to the provided options.
func (s *Store) Parts(ctx context.Context, opts ...PartsOption) ([]Part, error) {
	c := &partsConfig{}
	for _, opt := range opts {
		opt(c)
	}

	q := s.db.Select("id", "fleet", "original", "type", "name", "color").From("Parts")

	if c.color != "" {
		q = q.Where(goqu.C("color").Eq(c.color))
	}
	if c.fleet != "" {
		q = q.Where(goqu.C("fleet").Eq(c.fleet))
	}
	if c.name != "" {
		q = q.Where(goqu.C("name").Eq(c.name))
	}
	if c.original != "" {
		q = q.Where(goqu.C("original").Eq(c.original))
	}
	if c.partType != "" {
		q = q.Where(goqu.C("type").Eq(c.partType))
	}
	if c.orderBy != "" {
		q = q.Order(goqu.C(c.orderBy).Asc())
	}
	if c.limit != nil {
		q = q.Limit(*c.limit)
	}
	if c.offset != nil {
		q = q.Offset(*c.offset)
	}

	var parts []Part
	if err := q.ScanStructsContext(ctx, &parts); err != nil {
		return nil, fmt.Errorf("querying for parts: %v", err)
	}

	return parts, nil
}

// LayersConfig holds configuration calls to Layers.
type layersConfig struct {
	fleet   string
	parts   []PartNameAndColor
	orderBy string
	limit   *uint
	offset  *uint
}

// LayersOption controls the behavior of Layers.
type LayersOption func(*layersConfig)

// LayersOfFleet filters results to the specified fleet.
func LayersOfFleet(fleet string) LayersOption {
	return func(lc *layersConfig) {
		lc.fleet = fleet
	}
}

// PartNameAndColor is used to query Layers by part name and color.
type PartNameAndColor struct {
	PartName string
	Color    string
}

// LayersForParts filters results to the specified parts.
func LayersForParts(parts ...PartNameAndColor) LayersOption {
	return func(lc *layersConfig) {
		lc.parts = parts
	}
}

// OrderLayersBy orders results by the specified column asc.
func OrderLayersBy(orderBy string) LayersOption {
	return func(lc *layersConfig) {
		lc.orderBy = orderBy
	}
}

// LayersWithLimit limits the number of results returned.
func LayersWithLimit(limit uint) LayersOption {
	return func(lc *layersConfig) {
		lc.limit = &limit
	}
}

// LayersWithOffset offsets the beginning of the results returned.
func LayersWithOffset(offset uint) LayersOption {
	return func(lc *layersConfig) {
		lc.offset = &offset
	}
}

// Layers returns a list of Layers for the specified fleet and part name/colors.
func (s *Store) Layers(ctx context.Context, opts ...LayersOption) ([]Layer, error) {
	c := layersConfig{}
	for _, opt := range opts {
		opt(&c)
	}

	q := s.db.Select("*").From("layers")

	if c.fleet != "" {
		q = q.Where(goqu.C("fleet").Eq(c.fleet))
	}

	var ands []exp.Expression
	for _, part := range c.parts {
		ands = append(ands, goqu.And(goqu.C("part_name").Eq(part.PartName), goqu.C("color").Eq(part.Color)))
	}
	q = q.Where(goqu.Or(ands...))

	if c.orderBy != "" {
		q = q.Order(goqu.C(c.orderBy).Asc())
	}
	if c.limit != nil {
		q = q.Limit(*c.limit)
	}
	if c.offset != nil {
		q = q.Offset(*c.offset)
	}

	var layers []Layer
	if err := q.ScanStructsContext(ctx, &layers); err != nil {
		return nil, fmt.Errorf("querying layers: %v", err)
	}
	return layers, nil
}

type rigsConfig struct {
	limit  *uint
	offset *uint
}

// RigsOption controls the behavior of Rigs.
type RigsOption func(*rigsConfig)

// RigsWithLimit limits the number of results.
func RigsWithLimit(limit uint) RigsOption {
	return func(rc *rigsConfig) {
		rc.limit = &limit
	}
}

// RigsWithOffset specifies the offset of the results.
func RigsWithOffset(offset uint) RigsOption {
	return func(rc *rigsConfig) {
		rc.offset = &offset
	}
}

// Rigs returns a list of Rigs.
func (s *Store) Rigs(ctx context.Context, opts ...RigsOption) ([]Rig, error) {
	c := rigsConfig{}
	for _, opt := range opts {
		opt(&c)
	}

	q := s.db.Select("*").From("rigs")
	if c.limit != nil {
		q = q.Limit(*c.limit)
	}
	if c.offset != nil {
		q = q.Offset(*c.offset)
	}

	var rigs []Rig
	if err := q.ScanStructsContext(ctx, &rigs); err != nil {
		return nil, fmt.Errorf("querying rigs: %v", err)
	}
	for i := 0; i < len(rigs); i++ {
		q := s.db.Select("id", "fleet", "original", "type", "name", "color").
			From("rig_parts").
			Join(goqu.T("parts"), goqu.On(goqu.Ex{"rig_parts.part_id": goqu.I("parts.id")})).
			Where(goqu.C("rig_id").Eq(rigs[i].ID))
		var parts []Part
		if err := q.ScanStructsContext(ctx, &parts); err != nil {
			return nil, fmt.Errorf("querying parts for rig: %v", err)
		}
		rigs[i].Parts = parts
	}
	return rigs, nil
}

// Close implements Close.
func (s *Store) Close() error {
	if err := s.sqlDb.Close(); err != nil {
		return fmt.Errorf("closing sqlite db: %v", err)
	}
	return nil
}
