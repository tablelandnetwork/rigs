package tableland

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
)

func TestIt(t *testing.T) {
	db, err := sql.Open("sqlite3", "../../../local.db")
	require.NoError(t, err)
	defer func() {
		_ = db.Close()
	}()
	s, err := impl.NewStore(context.Background(), db)
	require.NoError(t, err)

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient("http://127.0.0.1:5001", httpClient)
	require.NoError(t, err)

	m := builder.NewBuilder(s, ipfs)
	g, err := NewTablelandGenerator(s, m, 1, "./cache")
	require.NoError(t, err)
	md, err := g.GenerateMetadata(context.Background(), 1, false)
	require.NoError(t, err)
	b, err := json.MarshalIndent(md, "", "  ")
	require.NoError(t, err)
	fmt.Println(string(b))
}
