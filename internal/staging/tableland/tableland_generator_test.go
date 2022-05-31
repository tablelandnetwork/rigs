package tableland

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/sqlite"
	"github.com/tablelandnetwork/nft-minter/minter"
)

func TestIt(t *testing.T) {
	s, err := sqlite.NewSQLiteStore("../../../inventory.db", false)
	require.NoError(t, err)

	httpClient := &http.Client{}
	ipfs, err := httpapi.NewURLApiWithClient("http://127.0.0.1:5001", httpClient)
	require.NoError(t, err)

	m := minter.NewMinter(s, 10, ipfs, nil)
	g, err := NewTablelandGenerator(s, m, 1, "./cache")
	require.NoError(t, err)
	md, err := g.GenerateMetadata(context.Background(), 1, false)
	require.NoError(t, err)
	b, err := json.MarshalIndent(md, "", "  ")
	require.NoError(t, err)
	fmt.Println(string(b))
}
