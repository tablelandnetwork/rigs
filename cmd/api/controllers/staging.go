package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/pkg/errors"
)

const (
	defaultCount = 100
	minCount     = 1
	maxCount     = 10000
)

// StagingController defines the HTTP handlers for interacting with staging operations.
type StagingController struct {
	stagingService staging.StagingService
}

// NewStagingController creates a new StagingController.
func NewStagingController(svc staging.StagingService) *StagingController {
	return &StagingController{svc}
}

// GetMetadata handles the GET /mint/staging call.
func (c *StagingController) GetMetadata(rw http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rw.Header().Set("Content-type", "application/json")

	count, err := strconv.Atoi(r.URL.Query().Get("count"))
	if err != nil || count < minCount || count > maxCount {
		count = defaultCount
	}

	reload, err := strconv.ParseBool(r.URL.Query().Get("reload"))
	if err != nil {
		reload = false
	}

	metadata, err := c.stagingService.GenerateMetadata(ctx, count, reload)
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		log.Ctx(ctx).
			Error().
			Err(err).
			Msg("failed to fetch metadata")

		_ = json.NewEncoder(rw).Encode(errors.ServiceError{
			Message: fmt.Sprintf("Failed to fetch metadata: %s", err),
		})
		return
	}

	rw.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(rw).Encode(metadata)
}
