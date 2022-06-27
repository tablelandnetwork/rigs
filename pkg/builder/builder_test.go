package builder

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"testing"
	"time"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
	"golang.org/x/time/rate"
)

func TestBuild(t *testing.T) {
	ctx := context.Background()

	db, err := sql.Open("sqlite3", "/Users/aaron/Code/textile/nft-minter/local.db")
	require.NoError(t, err)
	defer func() {
		_ = db.Close()
	}()

	s, err := impl.NewStore(ctx, db)
	require.NoError(t, err)

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient("http://127.0.0.1:5001", httpClient)
	require.NoError(t, err)

	m := NewBuilder(s, ipfs)

	originals, err := s.GetOriginalRigs(ctx)
	require.NoError(t, err)

	buildExecFcn := func(id int, original local.OriginalRig, opt BuildOption) wpool.ExecutionFn {
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
				BuildOriginal(i+1, original, system.NewSystemRandomnessSource()),
			),
		})
	}

	pool := wpool.New(10, rate.Every(time.Millisecond*100))
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
			fmt.Printf("%s%s\n", rig.Gateway.String, rig.Image.String)
		case <-pool.Done:
			return
		}
	}
}
