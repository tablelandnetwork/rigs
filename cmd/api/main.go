package main

import (
	"net/http"

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/cmd/api/controllers"
	"github.com/tablelandnetwork/nft-minter/cmd/api/middlewares"
	stagingimpl "github.com/tablelandnetwork/nft-minter/internal/staging/impl"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
	"github.com/tablelandnetwork/nft-minter/pkg/metrics"
)

func main() {
	config := setupConfig()
	logging.SetupLogger(buildinfo.GitCommit, config.Log.Debug, config.Log.Human)

	// conn, err := ethclient.Dial(config.Registry.EthEndpoint)
	// if err != nil {
	// 	log.Fatal().
	// 		Err(err).
	// 		Str("ethEndpoint", config.Registry.EthEndpoint).
	// 		Msg("failed to connect to ethereum endpoint")
	// }
	// defer conn.Close()
	//
	// registry, err := ethereum.NewClient(conn, common.HexToAddress(config.Registry.ContractAddress))
	// if err != nil {
	// 	log.Fatal().
	// 		Err(err).
	// 		Str("contractAddress", config.Registry.ContractAddress).
	// 		Msg("failed to create new ethereum client")
	// }

	stagingService, err := stagingimpl.NewSheetsGenerator(config.GCP.SheetID, config.GCP.ServiceAccountKeyFile)
	if err != nil {
		log.Fatal().
			Err(err).
			Msg("could not setup sheets generator")
	}
	stagingController := controllers.NewStagingController(stagingService)

	// General router configuration.
	router := newRouter()
	router.Use(middlewares.CORS, middlewares.TraceID)

	// Gateway configuration.
	// basicAuth := middlewares.BasicAuth(config.AdminAPI.Username, config.AdminAPI.Password)
	router.Get("/mint/staging", stagingController.GetMetadata, middlewares.OtelHTTP("GetMetadata"))

	// Health endpoint configuration.
	router.Get("/healthz", healthHandler)
	router.Get("/health", healthHandler)

	// Admin endpoint configuration.
	if config.Admin.Password == "" {
		log.Warn().
			Msg("no admin api password set")
	}

	// Validator instrumentation configuration.
	if err := metrics.SetupInstrumentation(":" + config.Metrics.Port); err != nil {
		log.Fatal().
			Err(err).
			Str("port", config.Metrics.Port).
			Msg("could not setup instrumentation")
	}

	if err := router.Serve(":" + config.HTTP.Port); err != nil {
		log.Fatal().
			Err(err).
			Str("port", config.HTTP.Port).
			Msg("could not start server")
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}
