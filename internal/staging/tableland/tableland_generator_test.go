package tableland

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/sqlite"
)

func TestIt(t *testing.T) {
	s, err := sqlite.NewSQLiteStore("../../../parts.db", false)
	require.NoError(t, err)
	g, err := NewTablelandGenerator(s, 1, "./cache")
	require.NoError(t, err)
	m, err := g.GenerateMetadata(context.Background(), 1, false)
	require.NoError(t, err)
	b, err := json.MarshalIndent(m, "", "  ")
	require.NoError(t, err)
	fmt.Println(string(b))
}
