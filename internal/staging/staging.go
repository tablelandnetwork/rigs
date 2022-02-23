package staging

import (
	"context"
)

// StagingService is used to generate nft metadata for development.
type StagingService interface {
	GenerateMetadata(context.Context, int, bool) (interface{}, error)
}
