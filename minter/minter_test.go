package minter

import (
	"context"
	"fmt"
	"image/png"
	"net/http"
	"testing"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/sqlite"
	"github.com/tablelandnetwork/nft-minter/minter/randomness/system"
)

func TestMint(t *testing.T) {
	s, err := sqlite.NewSQLiteStore("/Users/aaron/Code/textile/nft-minter/inventory.db", false)
	require.NoError(t, err)

	httpClient := &http.Client{}
	ipfs, err := httpapi.NewURLApiWithClient("http://127.0.0.1:5001", httpClient)
	require.NoError(t, err)

	m := NewMinter(s, 10, ipfs, nil)

	rig, err := m.Mint(
		context.Background(),
		1,
		system.NewSystemRandomnessSource(),
		1200,
		1200,
		png.DefaultCompression,
		true,
		true,
		false,
	)
	require.NoError(t, err)
	fmt.Println(rig)
}
