package minter

import (
	"context"
	"fmt"
	"image/png"
	"net/http"
	"testing"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/pkg/minter/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

func TestMint(t *testing.T) {
	ctx := context.Background()

	s, err := local.NewStore("/Users/aaron/Code/textile/nft-minter/local.db", false)
	require.NoError(t, err)

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient("http://127.0.0.1:5001", httpClient)
	require.NoError(t, err)

	m := NewMinter(s, 10, ipfs, "http://127.0.0.1:8080")

	originals, err := s.GetOriginalRigs(ctx)
	require.NoError(t, err)

	for i, original := range originals {
		fmt.Printf("%d. %s: %s %s\n", i+1, original.Fleet, original.Color, original.Name)
		rigs, err := m.Mint(
			ctx,
			1200,
			1200,
			png.DefaultCompression,
			false,
			false,
			Originals(system.NewSystemRandomnessSource(), OrignalTarget{ID: i + 1, Original: original}),
			// Randoms(system.NewSystemRandomnessSource(), 1, 2, 3),
		)
		if err != nil {
			fmt.Printf("%v\n\n", err)
			continue
		}
		require.Len(t, rigs, 1)
		// b, err := json.MarshalIndent(rigs[0], "", "  ")
		// require.NoError(t, err)
		// fmt.Printf("%s\n\n", string(b))
		fmt.Printf("%s\n\n", rigs[0].Image)
	}

	// for _, rig := range rigs {
	// 	b, err := json.MarshalIndent(rig, "", "  ")
	// 	require.NoError(t, err)
	// 	fmt.Println(string(b))
	// }
}
