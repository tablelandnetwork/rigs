package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

// LocalController provides interactions with the local.db Rigs data.
type LocalController struct {
	s local.Store
}

// NewLocalControlelr returns a new controller.
func NewLocalControlelr(s local.Store) *LocalController {
	return &LocalController{
		s: s,
	}
}

// Rigs handles calls to GET /rigs.
func (c *LocalController) Rigs(rw http.ResponseWriter, r *http.Request) {
	rigs, err := c.s.Rigs(r.Context())
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		log.Ctx(r.Context()).Error().Err(err).Msg("querying for rigs")
		return
	}
	rw.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(rw).Encode(rigs)
}
