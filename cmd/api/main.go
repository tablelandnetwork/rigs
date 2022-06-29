package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"

	"github.com/gorilla/mux"
	"github.com/phayes/freeport"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local/impl"
)

var store local.Store

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	db, err := sql.Open("sqlite3", "./local.db")
	if err != nil {
		log.Fatal().Err(err).Msg("opening sqlite db")
	}
	store, err = impl.NewStore(context.Background(), db)
	if err != nil {
		log.Fatal().Err(err).Msg("could not create store")
	}

	r := mux.NewRouter()
	r.HandleFunc("/rigs", rigsHandler)
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("client/dist")))

	port, err := freeport.GetFreePort()
	if err != nil {
		log.Fatal().Err(err).Msg("getting free port")
	}

	addr := fmt.Sprintf("localhost:%d", port)
	api := fmt.Sprintf("http://%s", addr)

	if err := os.Setenv("API", api); err != nil {
		log.Fatal().Err(err).Msg("setting api env var")
	}
	cmd := exec.Command("npm", "run", "generate")
	cmd.Dir = "client"
	stdout, err := cmd.Output()
	if err != nil {
		log.Fatal().Err(err).Msg("generating client app")
	}
	fmt.Println(string(stdout))

	go func() {
		if err := http.ListenAndServe(addr, r); err != nil {
			log.Fatal().Err(err).Int("port", port).Msg("could not start server")
		}
	}()

	log.Info().Msgf("server ready and listening at %s", api)

	handleInterrupt(func() {
		if err := db.Close(); err != nil {
			log.Error().Err(err).Msg("error closing local db")
		}
	})
}

func rigsHandler(rw http.ResponseWriter, r *http.Request) {
	rigs, err := store.Rigs(r.Context())
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		log.Error().Err(err).Msg("querying for rigs")
		return
	}
	rw.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(rw).Encode(rigs)
}

func handleInterrupt(stop func()) {
	quit := make(chan os.Signal)
	signal.Notify(quit, os.Interrupt) // nolint
	<-quit
	fmt.Println("Gracefully stopping... (press Ctrl+C again to force)")
	stop()
	os.Exit(1)
}
