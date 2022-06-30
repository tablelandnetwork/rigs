package builder

import (
	"context"
	"database/sql"
	"fmt"
	_ "image/gif"
	_ "image/jpeg"
	"net/http"
	"testing"
	"time"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/nullable"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
	"github.com/tablelandnetwork/nft-minter/pkg/wpool"
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

func Test_percentOriginal(t *testing.T) {
	type args struct {
		parts       []local.Part
		bonusFactor float64
	}
	tests := []struct {
		name string
		args args
		want float64
	}{
		{
			name: "totally different",
			args: args{
				parts: []local.Part{
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("2"), Color: nullable.FromString("grey")},
				},
				bonusFactor: 0.9,
			},
			want: 0.5,
		},
		{
			name: "original",
			args: args{
				parts: []local.Part{
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
				},
				bonusFactor: 0.9,
			},
			want: 1,
		},
		{
			name: "almost original",
			args: args{
				parts: []local.Part{
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("1"), Color: nullable.FromString("grey")},
				},
				bonusFactor: 0.9,
			},
			want: 0.95,
		},
		{
			name: "multiple matching + various other",
			args: args{
				parts: []local.Part{
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("2"), Color: nullable.FromString("grey")},
					{Original: nullable.FromString("3"), Color: nullable.FromString("blue")},
				},
				bonusFactor: 0.9,
			},
			want: 0.5,
		},
		{
			name: "multiple almost matching + various other",
			args: args{
				parts: []local.Part{
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("1"), Color: nullable.FromString("yellow")},
					{Original: nullable.FromString("2"), Color: nullable.FromString("grey")},
					{Original: nullable.FromString("3"), Color: nullable.FromString("blue")},
				},
				bonusFactor: 0.9,
			},
			want: 0.475,
		},
		{
			name: "bonus beats exact match + various other",
			args: args{
				parts: []local.Part{
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("1"), Color: nullable.FromString("black")},
					{Original: nullable.FromString("2"), Color: nullable.FromString("grey")},
					{Original: nullable.FromString("2"), Color: nullable.FromString("blue")},
					{Original: nullable.FromString("2"), Color: nullable.FromString("yellow")},
					{Original: nullable.FromString("3"), Color: nullable.FromString("pink")},
					{Original: nullable.FromString("4"), Color: nullable.FromString("purple")},
				},
				bonusFactor: 0.9,
			},
			want: 0.4,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := percentOriginal(tt.args.parts, tt.args.bonusFactor); !assert.InDelta(t, tt.want, got, 0.00001) {
				t.Errorf("percentOriginal() = %v, want %v", got, tt.want)
			}
		})
	}
}
