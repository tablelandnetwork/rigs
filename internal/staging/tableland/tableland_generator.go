package tableland

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"image/png"
	"io"
	"os"
	"sync"

	_ "github.com/mattn/go-sqlite3"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
)

// TablelandGenerator generates NFT metadata from traits defined in parts.db.
type TablelandGenerator struct {
	db       *sql.DB
	cacheDir string
	images   map[string]*staging.Image
	lk       sync.Mutex
	limiter  chan struct{}
}

// NewTablelandGenerator returns a new SQLiteGenerator.
func NewTablelandGenerator(
	dbFile string,
	concurrency int,
	cacheDir string,
) (*TablelandGenerator, error) {
	if concurrency < 1 {
		return nil, errors.New("concurrency must be greater than 1")
	}

	if len(cacheDir) != 0 {
		if err := os.MkdirAll(cacheDir, os.ModePerm); err != nil {
			return nil, fmt.Errorf("creating cache directory %v", err)
		}
	}

	db, err := sql.Open("sqlite3", dbFile)
	if err != nil {
		return nil, fmt.Errorf("opening db: %v", err)
	}
	return &TablelandGenerator{
		db:       db,
		cacheDir: cacheDir,
		images:   make(map[string]*staging.Image),
		limiter:  make(chan struct{}, concurrency),
	}, nil
}

func (g *TablelandGenerator) GenerateMetadata(
	_ context.Context,
	count int,
	reloadSheets bool,
) ([]staging.GeneratedMetadata, error) {
	log.Debug().
		Int("count", count).
		Bool("reload sheets", reloadSheets).
		Msg("generating metadata")

	var md []staging.GeneratedMetadata
	// for i := 0; i < count; i++ {
	// 	var m staging.Metadata
	// 	var dist, mindist, maxdist, rarity float64
	// 	for _, s := range g.sheets {
	// 		d, min, max, err := selectTrait(&m, s)
	// 		if err != nil {
	// 			return nil, fmt.Errorf("selecting trait %s: %v", s.Name, err)
	// 		}
	// 		dist += d
	// 		mindist += min
	// 		maxdist += max
	// 	}
	// 	if maxdist != 0 {
	// 		rarity = (dist - mindist) / (maxdist - mindist) // scale to range 0-1
	// 	}
	// 	md = append(md, staging.GeneratedMetadata{
	// 		Metadata: m,
	// 		Rarity:   staging.Rarity(rarity * 100),
	// 	})
	// }
	return md, nil
}

// func (g *TablelandGenerator) selectFleet(md *staging.Metadata) (float64, float64, float64, error) {

// }

// RenderImage returns an image based on the given metadata.
func (g *TablelandGenerator) RenderImage(
	_ context.Context,
	md staging.Metadata,
	seeds []float64,
	width, height int,
	compression png.CompressionLevel,
	drawLabels bool,
	reloadLayers bool,
	writer io.Writer,
) error {
	return nil

}

// Close implements io.Closer.
func (g *TablelandGenerator) Close() error {
	return g.db.Close()
}
