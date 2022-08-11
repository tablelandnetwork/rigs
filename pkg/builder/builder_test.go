package builder

import (
	_ "image/gif"
	_ "image/jpeg"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tablelandnetwork/rigs/pkg/nullable"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
)

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
