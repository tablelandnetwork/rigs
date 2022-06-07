package main

import (
	"context"
	"encoding/json"
	"fmt"
	"image/png"
	"net/http"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
	"github.com/tablelandnetwork/nft-minter/pkg/minter"
	"github.com/tablelandnetwork/nft-minter/pkg/minter/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/util"
)

type config struct {
	SQLiteDBPath string `default:""`
	LayersPath   string `default:""`
	IPFS         struct {
		APIAddr    string `default:"http://127.0.0.1:5001"`
		Pin        bool   `default:"false"`
		GatewayURL string `default:"http://127.0.0.1:8080"`
	}
	Images struct {
		Width  int  `default:"1200"`
		Height int  `default:"1200"`
		Labels bool `default:"false"`
	}
	Log struct {
		Human bool `default:"false"`
		Debug bool `default:"false"`
	}
}

var configFilename = "config.json"

func main() {
	// TODO: Make this an actually useful CLI.

	ctx := context.Background()

	config := &config{}
	util.SetupConfig(config, configFilename)

	logging.SetupLogger(buildinfo.GitCommit, config.Log.Debug, config.Log.Human)

	s, err := local.NewStore(config.SQLiteDBPath, false)
	if err != nil {
		log.Fatal().Err(err).Msg("creating sqlite store")
	}

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient(config.IPFS.APIAddr, httpClient)
	if err != nil {
		log.Fatal().Err(err).Msg("creating ipfs client")
	}

	m := minter.NewMinter(s, 10, ipfs, config.IPFS.GatewayURL)

	originals, err := s.GetOriginalRigs(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("getting originals")
	}

	for i, original := range originals {
		fmt.Printf("%d. %s: %s %s\n", i+1, original.Fleet, original.Color, original.Name)
		rigs, err := m.Mint(
			ctx,
			config.Images.Width,
			config.Images.Height,
			png.DefaultCompression,
			config.Images.Labels,
			config.IPFS.Pin,
			minter.Originals(system.NewSystemRandomnessSource(), minter.OrignalTarget{ID: i + 1, Original: original}),
			// Randoms(system.NewSystemRandomnessSource(), 1, 2, 3),
		)
		if err != nil {
			fmt.Printf("%v\n\n", err)
			continue
		}
		if len(rigs) != 1 {
			log.Fatal().Msgf("expected one rig but got %d", len(rigs))
		}
		b, err := json.MarshalIndent(rigs[0], "", "  ")
		if err != nil {
			log.Fatal().Err(err).Msg("marshaling rig to json")
		}
		fmt.Printf("%s\n\n", string(b))
	}
}
