package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
	"github.com/tablelandnetwork/nft-minter/pkg/util"
)

type config struct {
	Layers struct {
		Path string `default:""`
	}
	IPFS struct {
		APIAddr string `default:"http://127.0.0.1:5001"`
		Pin     bool   `default:"false"`
	}
	Log struct {
		Human bool `default:"false"`
		Debug bool `default:"false"`
	}
}

var configFilename = "config.json"

func main() {
	ctx := context.Background()

	config := &config{}
	util.SetupConfig(config, configFilename)
	logging.SetupLogger(buildinfo.GitCommit, config.Log.Debug, config.Log.Human)

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient(config.IPFS.APIAddr, httpClient)
	if err != nil {
		log.Fatal().Err(err).Msg("creating ipfs client")
	}

	fi, err := os.Stat(config.Layers.Path)
	if err != nil {
		log.Fatal().Err(err).Msg("statting path to layers")
	}

	node, err := ipfsfiles.NewSerialFile(config.Layers.Path, false, fi)
	if err != nil {
		log.Fatal().Err(err).Msg("creating searial file from path to layers")
	}

	fmt.Println("Adding layers to IPFS...")

	path, err := ipfs.Unixfs().Add(ctx, node, options.Unixfs.Pin(config.IPFS.Pin))
	if err != nil {
		log.Fatal().Err(err).Msg("adding images to ipfs")
	}

	fmt.Printf("Layers loaded to IPFS with path %s\n", path.String())
}
