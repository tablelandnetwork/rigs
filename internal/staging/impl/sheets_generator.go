package impl

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"google.golang.org/api/option"
	gsheets "google.golang.org/api/sheets/v4"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

// Trait defines a single NFT trait.
type Trait struct {
	DisplayType string `json:"display_type,omitempty"`
	TraitType   string `json:"trait_type"`
	Value       string `json:"value"`
}

// Metadata defines NFT metadata.
type Metadata struct {
	Attributes []Trait `json:"attributes"`
}

// Sheet defines a trait sheet imported from google sheets.
type Sheet struct {
	Name      string              `json:"name"`
	Range     string              `json:"range"`
	DependsOn []string            `json:"depends_on"`
	Opts      []map[string]string `json:"opts"`
}

// SheetsGenerator generates NFT metadata from traits defined in google sheets.
type SheetsGenerator struct {
	sc *gsheets.Service
	id string

	sheets []Sheet
	cancel context.CancelFunc
}

// NewSheetsGenerator returns a new SheetsGenerator.
func NewSheetsGenerator(sheetID string, keyfile string) (*SheetsGenerator, error) {
	ctx, cancel := context.WithCancel(context.Background())
	sc, err := gsheets.NewService(ctx, option.WithCredentialsJSON([]byte(keyfile)))
	if err != nil {
		cancel()
		return nil, fmt.Errorf("building sheets client %v", err)
	}

	sheets := []Sheet{
		{
			Name:  "Fleet",
			Range: "!A1:B5",
		},
		{
			Name:      "Class",
			Range:     "!A1:C9",
			DependsOn: []string{"Fleet"},
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
		// {
		// 	Name:      "Back Attachments",
		// 	Range:     "!A1:D27",
		// 	DependsOn: []string{"Fleet", "Class"},
		// },
		// {
		// 	Name:      "Top Attachments",
		// 	Range:     "!A1:D13",
		// 	DependsOn: []string{"Fleet", "Class"},
		// },
	}

	g := &SheetsGenerator{
		sc:     sc,
		id:     sheetID,
		sheets: sheets,
		cancel: cancel,
	}

	if err := g.getTraitSheets(); err != nil {
		return nil, fmt.Errorf("getting trait sheets: %v", err)
	}
	return g, nil
}

// Close implements io.Closer.
func (g *SheetsGenerator) Close() error {
	g.cancel()
	return nil
}

// GenerateMetadata returns count metadata items, and optionally reloads trait sheets.
func (g *SheetsGenerator) GenerateMetadata(ctx context.Context, count int, reloadSheets bool) (interface{}, error) {
	if reloadSheets {
		if err := g.getTraitSheets(); err != nil {
			return nil, fmt.Errorf("getting trait sheets: %v", err)
		}
	}

	var md []Metadata
	for i := 0; i < count; i++ {
		var m Metadata
		for _, s := range g.sheets {
			if err := selectTrait(&m, s); err != nil {
				return nil, fmt.Errorf("selecting trait %s: %v", s.Name, err)
			}
		}
		md = append(md, m)
	}
	return md, nil
}

func (g *SheetsGenerator) getTraitSheets() error {
	for i, s := range g.sheets {
		ts, err := g.getTraitSheet(s.Name + s.Range)
		if err != nil {
			return fmt.Errorf("getting trait sheet %s: %v", s.Name, err)
		}
		s.Opts = ts
		g.sheets[i] = s
	}
	return nil
}

func (g *SheetsGenerator) getTraitSheet(name string) ([]map[string]string, error) {
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

func getTrait(name string, md *Metadata) *Trait {
	for _, t := range md.Attributes {
		if t.TraitType == name {
			return &t
		}
	}
	return nil
}

func selectTrait(md *Metadata, sheet Sheet) error {
	var filter []Trait
	for _, x := range sheet.DependsOn {
		t := getTrait(x, md)
		if t == nil {
			return fmt.Errorf("trait %s depends on trait %s", sheet.Name, x)
		}
		filter = append(filter, *t)
	}

	var (
		upper float64
		lower float64
		num   = rand.Float64()
		trait Trait
	)
outer:
	for i := len(sheet.Opts) - 1; i >= 0; i-- {
		opt := sheet.Opts[i]

		for _, f := range filter {
			if opt[f.TraitType] != f.Value {
				continue outer
			}
		}

		d, ok := opt["Distribution"]
		if !ok {
			return fmt.Errorf("trait option in sheet %s missing distribution", sheet.Name)
		}
		df, err := strconv.ParseFloat(d, 64)
		if err != nil {
			return fmt.Errorf("parsing distribution in sheet %s: %v", sheet.Name, err)
		}

		upper += df
		if num < upper && num >= lower {
			trait.TraitType = sheet.Name
			trait.Value = sheet.Opts[i]["Value"]
			md.Attributes = append(md.Attributes, trait)
			return nil
		}
		lower = upper
	}
	return nil
}
