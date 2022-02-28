package impl

import (
	"context"
	"fmt"
	"image/png"
	"io"
	"io/ioutil"
	"math/rand"
	"path"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/pkg/renderer"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	gsheets "google.golang.org/api/sheets/v4"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// Sheet defines a trait sheet imported from google sheets.
type Sheet struct {
	Name      string
	Range     string
	DependsOn []string
	Opts      []map[string]string
	Label     bool
}

// SheetsGenerator generates NFT metadata from traits defined in google sheets.
type SheetsGenerator struct {
	sc *gsheets.Service
	dc *drive.Service
	id string

	sheets []Sheet
	layers Sheet
	images map[string]*staging.Image
	cancel context.CancelFunc
	lk     sync.Mutex
}

// NewSheetsGenerator returns a new SheetsGenerator.
func NewSheetsGenerator(sheetID, driveFolderID, keyfile string) (*SheetsGenerator, error) {
	ctx, cancel := context.WithCancel(context.Background())
	sc, err := gsheets.NewService(ctx, option.WithCredentialsJSON([]byte(keyfile)))
	if err != nil {
		cancel()
		return nil, fmt.Errorf("building sheets client %v", err)
	}

	dc, err := drive.NewService(ctx, option.WithCredentialsJSON([]byte(keyfile)))
	if err != nil {
		cancel()
		return nil, fmt.Errorf("building drive client %v", err)
	}

	sheets := []Sheet{
		{
			Name:  "Fleet",
			Range: "!A1:B5",
			Label: true,
		},
		{
			Name:      "Class",
			Range:     "!A1:C9",
			DependsOn: []string{"Fleet"},
			Label:     true,
		},
		{
			Name:      "Background",
			Range:     "!A1:D93",
			DependsOn: []string{"Fleet", "Class"},
		},
		{
			Name:      "Body",
			Range:     "!A1:D75",
			DependsOn: []string{"Fleet", "Class"},
		},
		{
			Name:      "Locomotion",
			Range:     "!A1:D85",
			DependsOn: []string{"Fleet", "Class"},
		},
		{
			Name:      "Cockpit",
			Range:     "!A1:D77",
			DependsOn: []string{"Fleet", "Class"},
		},
		{
			Name:      "Back Attachments",
			Range:     "!A1:D53",
			DependsOn: []string{"Fleet", "Class"},
		},
		{
			Name:      "Top Attachments",
			Range:     "!A1:D25",
			DependsOn: []string{"Fleet", "Class"},
		},
	}
	layers := Sheet{
		Name:      "Layers",
		Range:     "!A1:E46",
		DependsOn: []string{"Fleet", "Class"},
	}

	g := &SheetsGenerator{
		sc:     sc,
		dc:     dc,
		id:     sheetID,
		sheets: sheets,
		layers: layers,
		images: make(map[string]*staging.Image),
		cancel: cancel,
	}

	if err := g.getTraitSheets(); err != nil {
		return nil, err
	}
	if err := g.getLayersSheet(); err != nil {
		return nil, err
	}
	if err := g.getLayerImages(driveFolderID); err != nil {
		return nil, err
	}

	log.Info().Msg("let's go")
	return g, nil
}

func (g *SheetsGenerator) getTraitSheets() error {
	log.Info().Msg("loading trait sheets")
	for i, s := range g.sheets {
		ts, err := g.getSheet(s.Name + s.Range)
		if err != nil {
			return fmt.Errorf("getting trait sheet %s: %v", s.Name, err)
		}
		s.Opts = ts
		g.sheets[i] = s
	}
	return nil
}

func (g *SheetsGenerator) getLayersSheet() error {
	log.Info().Msg("loading layer sheets")
	s, err := g.getSheet(g.layers.Name + g.layers.Range)
	if err != nil {
		return fmt.Errorf("getting layer sheet: %v", err)
	}
	g.layers.Opts = s
	return nil
}

func (g *SheetsGenerator) getSheet(name string) ([]map[string]string, error) {
	res, err := g.sc.Spreadsheets.Values.Get(g.id, name).Do()
	if err != nil {
		return nil, fmt.Errorf("unable to retrieve sheet %s: %v", name, err)
	}

	if len(res.Values) < 2 {
		return nil, fmt.Errorf("no data found in sheet %s", name)
	}

	rows := make([]map[string]string, len(res.Values)-1)
	var cols []string
	for i, r := range res.Values {
		if i == 0 {
			cols = make([]string, len(r))
			for j, c := range r {
				cols[j] = c.(string)
			}
		} else if len(cols) > 0 {
			row := make(map[string]string)
			for j, c := range r {
				row[cols[j]] = c.(string)
			}
			rows[i-1] = row
		}
	}

	return rows, nil
}

func (g *SheetsGenerator) getLayerImages(folderID string) error {
	log.Info().Msg("loading layer images")
	return g.walkFiles("", folderID)
}

func (g *SheetsGenerator) walkFiles(pth string, fileID string) error {
	res, err := g.dc.Files.List().Q(fmt.Sprintf("'%s' in parents", fileID)).Do()
	if err != nil {
		return fmt.Errorf("listing files: %v", err)
	}
	for _, f := range res.Files {
		switch f.MimeType {
		case "application/vnd.google-apps.folder":
			if err := g.walkFiles(path.Join(pth, f.Name), f.Id); err != nil {
				return fmt.Errorf("walking files: %v", err)
			}
		case "image/png":
			name := f.Name[0 : len(f.Name)-len(path.Ext(f.Name))]
			g.images[path.Join(pth, name)] = &staging.Image{
				ID:    f.Id,
				Layer: name,
			}
		default:
			return fmt.Errorf("unknown mime type: %s", f.MimeType)
		}
	}
	return nil
}

// GenerateMetadata returns count metadata items, and optionally reloads trait sheets.
func (g *SheetsGenerator) GenerateMetadata(
	_ context.Context,
	count int,
	reloadSheets bool,
) ([]staging.Metadata, error) {
	log.Debug().
		Int("count", count).
		Bool("reload sheets", reloadSheets).
		Msg("generating metadata")

	if reloadSheets {
		if err := g.getTraitSheets(); err != nil {
			return nil, err
		}
	}

	var md []staging.Metadata
	for i := 0; i < count; i++ {
		var m staging.Metadata
		for _, s := range g.sheets {
			if err := selectTrait(&m, s); err != nil {
				return nil, fmt.Errorf("selecting trait %s: %v", s.Name, err)
			}
		}
		md = append(md, m)
	}
	return md, nil
}

func selectTrait(md *staging.Metadata, sheet Sheet) error {
	filter, err := getFilter(*md, sheet)
	if err != nil {
		return fmt.Errorf("getting trait filter: %v", err)
	}

	var (
		upper float64
		lower float64
		num   = rand.Float64()
	)
outer:
	for i := len(sheet.Opts) - 1; i >= 0; i-- {
		opt := sheet.Opts[i]

		for _, f := range filter {
			if opt[f.TraitType] != f.Value {
				continue outer
			}
		}

		d, err := getSheetRowValue(opt, "Distribution")
		if err != nil {
			return fmt.Errorf("getting row value in sheet %s: %v", sheet.Name, err)
		}
		df, err := strconv.ParseFloat(d, 64)
		if err != nil {
			return fmt.Errorf("parsing distribution in sheet %s: %v", sheet.Name, err)
		}

		upper += df
		if num < upper && num >= lower {
			v, err := getSheetRowValue(opt, "Value")
			if err != nil {
				return fmt.Errorf("getting row value in sheet %s: %v", sheet.Name, err)
			}
			if v != "none" {
				md.Attributes = append(md.Attributes, staging.Trait{
					TraitType: sheet.Name,
					Value:     v,
				})
			}
			return nil
		}
		lower = upper
	}
	return nil
}

func getFilter(md staging.Metadata, sheet Sheet) ([]staging.Trait, error) {
	var filter []staging.Trait
	for _, x := range sheet.DependsOn {
		t := getTrait(x, md)
		if t == nil {
			return nil, fmt.Errorf("%s depends on trait %s", sheet.Name, x)
		}
		filter = append(filter, *t)
	}
	return filter, nil
}

func getTrait(name string, md staging.Metadata) *staging.Trait {
	for _, t := range md.Attributes {
		if t.TraitType == name {
			return &t
		}
	}
	return nil
}

func getSheetRowValue(opt map[string]string, name string) (string, error) {
	d, ok := opt[name]
	if !ok {
		return "", fmt.Errorf("sheet row missing %s", name)
	}
	return d, nil
}

// RenderImage returns an image based on the given metadata.
func (g *SheetsGenerator) RenderImage(
	_ context.Context,
	md staging.Metadata,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	reloadLayers bool,
	darkMode bool,
	writer io.Writer,
) error {
	logMemUsage()

	log.Debug().
		Bool("reload layers", reloadLayers).
		Msg("rendering image")

	if reloadLayers {
		if err := g.getLayersSheet(); err != nil {
			return err
		}
	}

	layers, err := getLayers(md, g.layers)
	if err != nil {
		return fmt.Errorf("getting layers: %v", err)
	}

	var label string
	if drawLabels {
		label = g.getTraitsLabel(md)
	}

	r, err := renderer.NewRenderer(width, height, drawLabels, label, darkMode)
	if err != nil {
		return fmt.Errorf("building renderer: %v", err)
	}
	defer r.Dispose()
	for _, l := range layers {
		if l.Trait == nil {
			continue // trait was optional
		}
		pth := path.Join(l.Name, l.Trait.Value)
		img, err := g.fetchImage(pth, reloadLayers)
		if err != nil {
			return fmt.Errorf("fetching image: %v", err)
		}
		if img == nil {
			continue // layer was optional
		}

		log.Debug().
			Str("name", img.Layer).
			Msg("adding layer")

		if err := r.AddLayer(img.Bytes, img.Layer); err != nil {
			return fmt.Errorf("adding layer: %v", err)
		}
	}

	return r.Write(writer, compression)
}

func (g *SheetsGenerator) getTraitsLabel(md staging.Metadata) string {
	var label []string
	for _, s := range g.sheets {
		if s.Label {
			if t := getTrait(s.Name, md); t != nil {
				label = append(label, t.Value)
			}
		}
	}
	return strings.Join(label, ", ")
}

func getLayers(md staging.Metadata, sheet Sheet) ([]staging.Layer, error) {
	filter, err := getFilter(md, sheet)
	if err != nil {
		return nil, fmt.Errorf("getting trait filter: %v", err)
	}
	var prefix string
	for _, f := range filter {
		prefix += f.Value + "/"
	}

	tmp := make(map[int]staging.Layer)
outer:
	for _, opt := range sheet.Opts {
		for _, f := range filter {
			if opt[f.TraitType] != f.Value {
				continue outer
			}
		}

		r, err := getSheetRowValue(opt, "Order")
		if err != nil {
			return nil, fmt.Errorf("getting row value in sheet %s: %v", sheet.Name, err)
		}
		o, err := strconv.Atoi(r)
		if err != nil {
			return nil, fmt.Errorf("parsing layer: %v", err)
		}

		t, err := getSheetRowValue(opt, "Trait")
		if err != nil {
			return nil, fmt.Errorf("getting row value in sheet %s: %v", sheet.Name, err)
		}
		trait := getTrait(t, md)
		if trait == nil {
			tmp[o] = staging.Layer{}
			continue // trait was optional
		}

		l, err := getSheetRowValue(opt, "Layer")
		if err != nil {
			return nil, fmt.Errorf("getting row value in sheet %s: %v", sheet.Name, err)
		}

		tmp[o] = staging.Layer{
			Name:  prefix + l,
			Trait: trait,
		}
	}

	layers := make([]staging.Layer, len(tmp))
	for k, v := range tmp {
		layers[k] = v
	}
	return layers, nil
}

func (g *SheetsGenerator) fetchImage(pth string, force bool) (*staging.Image, error) {
	g.lk.Lock()
	img, ok := g.images[pth]
	g.lk.Unlock()
	if !ok {
		return nil, nil
	}

	if img.Bytes != nil && !force {
		return img, nil // don't load again
	}

	log.Info().
		Str("path", pth).
		Msg("fetching image")

	r, err := g.dc.Files.Get(img.ID).Download()
	if err != nil {
		return nil, fmt.Errorf("downloading file: %v", err)
	}
	bytes, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("reading file: %v", err)
	}

	img.Bytes = bytes
	g.lk.Lock()
	g.images[pth] = img
	g.lk.Unlock()
	return img, nil
}

// Close implements io.Closer.
func (g *SheetsGenerator) Close() error {
	g.cancel()
	return nil
}

func logMemUsage() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	log.Debug().
		Str("alloc", fmt.Sprintf("%v", bToMb(m.Alloc))).
		Str("total", fmt.Sprintf("%v", bToMb(m.TotalAlloc))).
		Str("sys", fmt.Sprintf("%v", bToMb(m.Sys))).
		Str("gc", fmt.Sprintf("%v", m.NumGC)).
		Msg("memstats")
}

func bToMb(b uint64) uint64 {
	return b / 1024 / 1024
}
