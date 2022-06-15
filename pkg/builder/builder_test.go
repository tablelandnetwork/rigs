package builder

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

func TestBuild(t *testing.T) {
	ctx := context.Background()

	s, err := local.NewStore("/Users/aaron/Code/textile/nft-minter/local.db", false)
	require.NoError(t, err)

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient("http://127.0.0.1:5001", httpClient)
	require.NoError(t, err)

	m := NewBuilder(s, ipfs, "http://127.0.0.1:8080")

	originals, err := s.GetOriginalRigs(ctx)
	require.NoError(t, err)

	buildExecFcn := func(id int, original local.OriginalRig, opt Option) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			fmt.Printf("%d. %s: %s %s\n", id, original.Fleet, original.Color, original.Name)
			rig, err := m.Build(ctx, opt)
			return rig, err
		}
	}

	var jobs []wpool.Job
	for i, original := range originals {
		jobs = append(jobs, wpool.Job{
			ID: wpool.JobID(i + 1),
			ExecFn: buildExecFcn(
				i+1,
				original,
				Original(i+1, original, system.NewSystemRandomnessSource()),
			),
		})
	}

	pool := wpool.New(10)
	go pool.GenerateFrom(jobs)
	go pool.Run(ctx)

	for {
		select {
		case r, ok := <-pool.Results():
			if !ok {
				continue
			}
			require.NoError(t, r.Err)
			rig := r.Value.(*local.Rig)
			require.Equal(t, int(r.ID), rig.ID)
			fmt.Printf("%s\n", rig.Image)
		case <-pool.Done:
			return
		}
	}
}
