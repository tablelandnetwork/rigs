package staging

import (
	"context"
)

type StagingService interface {
	GenerateMetadata(context.Context, int, bool) (interface{}, error)
}
