package tableland

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/sqlite"
	"github.com/tablelandnetwork/nft-minter/minter"
)

func TestIt(t *testing.T) {
	s, err := sqlite.NewSQLiteStore("../../../parts.db", false)
	require.NoError(t, err)
	m := minter.NewMinter(s, 10)
	g, err := NewTablelandGenerator(s, m, 1, "./cache")
	require.NoError(t, err)
	md, err := g.GenerateMetadata(context.Background(), 1, false)
	require.NoError(t, err)
	b, err := json.MarshalIndent(md, "", "  ")
	require.NoError(t, err)
	fmt.Println(string(b))
}
