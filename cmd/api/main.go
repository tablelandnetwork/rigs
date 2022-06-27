package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"

	"github.com/gorilla/mux"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/cmd/api/controllers"
	"github.com/tablelandnetwork/nft-minter/cmd/api/middlewares"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
	"github.com/tablelandnetwork/nft-minter/pkg/metrics"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
	"github.com/tablelandnetwork/nft-minter/pkg/util"
)

func main() {
	config := &config{}
	util.SetupConfig(config, configFilename)
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

	db, err := sql.Open("sqlite3", "./local.db")
	if err != nil {
		log.Fatal().Err(err).Msg("opening sqlite db")
	}
	defer func() {
		_ = db.Close()
	}()
	store, err := impl.NewStore(context.Background(), db)
	if err != nil {
		log.Fatal().Err(err).Msg("could not create store")
	}

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient(config.IPFS.APIAddr, httpClient)
	if err != nil {
		log.Fatal().Err(err).Msg("creating ipfs client")
	}

	builder := builder.NewBuilder(store, ipfs)

	stagingService, err := tableland.NewTablelandGenerator(
		store,
		builder,
		config.Render.Concurrency,
		config.Render.CacheDir,
	)

	// stagingService, err := sheets.NewSheetsGenerator(
	// 	config.GCP.SheetID,
	// 	config.GCP.DriveFolderID,
	// 	config.GCP.ServiceAccountKeyFile,
	// 	config.Render.Concurrency,
	// 	config.Render.CacheDir,
	// )
	if err != nil {
		log.Fatal().
			Err(err).
			Msg("could not setup generator")
	}
	stagingController := controllers.NewStagingController(stagingService)
	localController := controllers.NewLocalControlelr(store)

	// General router configuration.
	router := newRouter()
	router.Use(middlewares.CORS(strings.Split(config.HTTP.Origins, ",")), middlewares.TraceID)

	// Gateway configuration.
	var middleware []mux.MiddlewareFunc
	if !strings.Contains(config.HTTP.Origins, "localhost") {
		basicAuth := middlewares.BasicAuth(config.Admin.Username, config.Admin.Password)
		middleware = append(middleware, basicAuth)
	}
	router.Get(
		"/generate",
		stagingController.GenerateMetadata,
		append(middleware, middlewares.OtelHTTP("GenerateMetadata"))...,
	)
	router.Get("/render", stagingController.RenderImage, middlewares.OtelHTTP("RenderImage"))
	router.Get("/rigs", localController.Rigs, append(middleware, middlewares.OtelHTTP("Rigs"))...)

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

	// Start HTTP server.
	go func() {
		if err := router.Serve(":" + config.HTTP.Port); err != nil {
			log.Fatal().
				Err(err).
				Str("port", config.HTTP.Port).
				Msg("could not start server")
		}
	}()

	handleInterrupt(func() {
		if err := stagingService.Close(); err != nil {
			log.Fatal().
				Err(err).
				Msg("error closing staging service")
		}
	})
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func handleInterrupt(stop func()) {
	quit := make(chan os.Signal)
	signal.Notify(quit, os.Interrupt) // nolint
	<-quit
	fmt.Println("Gracefully stopping... (press Ctrl+C again to force)")
	stop()
	os.Exit(1)
}
