package sqlite

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetOriginalRigs(t *testing.T) {
	s, err := NewSQLiteStore("../../../../../local.db", false)
	require.NoError(t, err)

	originals, err := s.GetOriginalRigs(context.Background())
	require.NoError(t, err)
	require.Len(t, originals, 181)
}
