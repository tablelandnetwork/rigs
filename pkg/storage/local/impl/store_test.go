package impl

import (
	"context"
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/rigs/pkg/nullable"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
)

func TestStore_Reset(t *testing.T) {
	s, cleanup := requireStore(t)
	t.Cleanup(cleanup)

	err := s.Reset(context.Background())
	require.NoError(t, err)
}

func TestStore_InsertParts(t *testing.T) {
	s, cleanup := requireStore(t)
	t.Cleanup(cleanup)

	parts := []local.Part{
		{
			Fleet: nullable.FromString("Fleet One"),
		},
		{
			Fleet: nullable.FromString("Fleet Two"),
		},
	}

	err := s.InsertParts(context.Background(), parts)
	require.NoError(t, err)
}

func TestStore_GetOriginalRigs(t *testing.T) {
	s, cleanup := requireStore(t)
	t.Cleanup(cleanup)

	originals, err := s.GetOriginalRigs(context.Background())
	require.NoError(t, err)
	require.Len(t, originals, 181)
}

func TestStore_GetPartTypesByFleet(t *testing.T) {
	s, cleanup := requireStore(t)
	t.Cleanup(cleanup)

	partTypes, err := s.GetPartTypesByFleet(context.Background(), "Titans")
	require.NoError(t, err)
	require.Len(t, partTypes, 6)
}

func TestStore_Parts(t *testing.T) {
	s, cleanup := requireStore(t)
	t.Cleanup(cleanup)

	parts, err := s.Parts(context.Background(), local.PartsOfColor("Dark"), local.PartsOfFleet("Titans"))
	require.NoError(t, err)
	require.Len(t, parts, 4)
}

func TestStore_Layers(t *testing.T) {
	s, cleanup := requireStore(t)
	t.Cleanup(cleanup)

	layers, err := s.Layers(
		context.Background(),
		local.LayersOfFleet("Airelights"),
		local.LayersForParts(
			local.PartNameAndColor{PartName: "Varchar", Color: "Sunset"},
			local.PartNameAndColor{PartName: "Alpine 4", Color: "Dark"},
		),
	)
	require.NoError(t, err)
	require.Len(t, layers, 2)
}

func requireStore(t *testing.T) (local.Store, func()) {
	db, err := sql.Open("sqlite3", "file::memory:?cache=shared")
	require.NoError(t, err)
	s, err := NewStore(context.Background(), db)
	require.NoError(t, err)
	return s, func() {
		_ = db.Close()
	}
}
