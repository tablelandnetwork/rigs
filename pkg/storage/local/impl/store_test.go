package impl

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/doug-martin/goqu/v9"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/common"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

func TestStore_CreateTables(t *testing.T) {
	db, cleanup := requireDB(t)
	t.Cleanup(cleanup)

	s := &Store{
		db: goqu.New("sqlite3", db),
	}

	err := s.CreateTables(context.Background())
	require.NoError(t, err)
}

func TestStore_InsertParts(t *testing.T) {
	db, cleanup := requireDB(t)
	t.Cleanup(cleanup)

	s := &Store{
		db: goqu.New("sqlite3", db),
	}

	err := s.CreateTables(context.Background())
	require.NoError(t, err)

	parts := []local.Part{
		{
			Fleet: common.NullableString{NullString: sql.NullString{String: "Fleet One", Valid: true}},
		},
		{
			Fleet: common.NullableString{NullString: sql.NullString{String: "Fleet Two", Valid: true}},
		},
	}

	err = s.InsertParts(context.Background(), parts)
	require.NoError(t, err)
}

func TestStore_GetOriginalRigs(t *testing.T) {
	s, err := NewStore("../../../local.db", false)
	require.NoError(t, err)

	originals, err := s.GetOriginalRigs(context.Background())
	require.NoError(t, err)
	require.Len(t, originals, 181)
}

func TestStore_GetPartTypesByFleet(t *testing.T) {
	s, err := NewStore("../../../local.db", false)
	require.NoError(t, err)

	partTypes, err := s.GetPartTypesByFleet(context.Background(), "Titans")
	require.NoError(t, err)
	require.Len(t, partTypes, 6)
}

func TestStore_Parts(t *testing.T) {
	s, err := NewStore("../../../local.db", false)
	require.NoError(t, err)

	parts, err := s.Parts(context.Background(), local.PartsOfColor("Dark"), local.PartsOfFleet("Titans"))
	require.NoError(t, err)
	require.Len(t, parts, 4)
}

func TestStore_Layers(t *testing.T) {
	s, err := NewStore("../../../local.db", false)
	require.NoError(t, err)

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

func requireDB(t *testing.T) (*sql.DB, func()) {
	db, err := sql.Open("sqlite3", "test.db")
	require.NoError(t, err)
	return db, func() {
		_ = os.Remove("test.db")
	}
}
