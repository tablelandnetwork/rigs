package common

import (
	"fmt"
	"testing"

	_ "github.com/doug-martin/goqu/v9/dialect/sqlite3"
	"github.com/stretchr/testify/require"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
)

func TestGetSQLForGettingLayers(t *testing.T) {
	exp := "select * from layers where fleet = 'foo' and (part = 'bar' or part = 'baz') order by position;"
	res := SQLForGettingLayers("foo", []string{"bar", "baz"})
	require.Equal(t, exp, res)
}

func TestFoo(t *testing.T) {
	rig1 := store.Rig{
		ID:    1,
		Image: "image here",
		Attributes: []store.RigAttribute{
			{DisplayType: "string", TraitType: "Color", Value: "Grey"},
			{DisplayType: "number", TraitType: "Age", Value: 40},
		},
	}
	rig2 := store.Rig{
		ID:    2,
		Image: "image here",
		Attributes: []store.RigAttribute{
			{DisplayType: "string", TraitType: "Color", Value: "Grey"},
			{DisplayType: "number", TraitType: "Age", Value: 40},
		},
	}

	sql, err := SQLForInsertingRigs([]store.Rig{rig1, rig2})
	require.NoError(t, err)

	fmt.Println(sql)
}
