package controllers

import (
	"encoding/json"
	"fmt"
	"image/png"
	"net/http"
	"net/url"
	"strconv"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/internal/staging"
	"github.com/tablelandnetwork/nft-minter/pkg/errors"
)

const (
	defaultCount = 100
	minCount     = 1
	maxCount     = 10000

	defaultSize = 1280
	minSize     = 80
	maxSize     = 4000

	defaultCompression = int(png.DefaultCompression)
)

// StagingController defines the HTTP handlers for interacting with staging operations.
type StagingController struct {
	stagingService staging.Service
}

// NewStagingController creates a new StagingController.
func NewStagingController(svc staging.Service) *StagingController {
	return &StagingController{svc}
}

// GenerateMetadata handles the GET /generate call.
func (c *StagingController) GenerateMetadata(rw http.ResponseWriter, r *http.Request) {
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

// RenderImage handles the GET /render call.
func (c *StagingController) RenderImage(rw http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rw.Header().Set("Content-type", "image/png")

	jsn, err := url.QueryUnescape(r.URL.Query().Get("metadata"))
	if err != nil {
		rw.WriteHeader(http.StatusBadRequest)
		log.Ctx(ctx).
			Error().
			Err(err).
			Msg("metadata must be url escaped json")
		return
	}

	var metadata staging.Metadata
	if err := json.Unmarshal([]byte(jsn), &metadata); err != nil {
		rw.WriteHeader(http.StatusBadRequest)
		log.Ctx(ctx).
			Error().
			Err(err).
			Msg("metadata is malformed")
		return
	}

	size, err := strconv.Atoi(r.URL.Query().Get("size"))
	if err != nil || size < minSize || size > maxSize {
		size = defaultSize
	}

	compression, err := strconv.Atoi(r.URL.Query().Get("compression"))
	if err != nil || compression > 0 || compression < -3 {
		compression = defaultCompression
	}

	labels, err := strconv.ParseBool(r.URL.Query().Get("labels"))
	if err != nil {
		labels = false
	}

	reload, err := strconv.ParseBool(r.URL.Query().Get("reload"))
	if err != nil {
		reload = false
	}

	rw.WriteHeader(http.StatusOK)
	if err := c.stagingService.RenderImage(
		ctx,
		metadata,
		size, size,
		png.CompressionLevel(compression),
		labels, reload,
		rw,
	); err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		log.Ctx(ctx).
			Error().
			Err(err).
			Msg("failed to render image")
	}
}
