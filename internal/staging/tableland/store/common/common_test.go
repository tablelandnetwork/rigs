package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetSQLForGettingLayers(t *testing.T) {
	exp := "select * from layers where fleet = 'foo' and (part = 'bar' or part = 'baz') order by position;"
	res := SQLForGettingLayers("foo", []string{"bar", "baz"})
	require.Equal(t, exp, res)
}
