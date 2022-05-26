package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	ipfsfiles "github.com/ipfs/go-ipfs-files"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/ipfs/interface-go-ipfs-core/options"
	"github.com/omeid/uconfig"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
)

type config struct {
	LayersPath string `default:""`
	IPFS       struct {
		APIAddr string `default:"http://127.0.0.1:5001"`
		Pin     bool   `default:"false"`
	}
	RemoteIPFS struct {
		APIAddr string `default:"https://ipfs.infura.io:5001"`
		APIUser string `default:""`
		APIPass string `default:""`
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

	config := setupConfig()
	logging.SetupLogger(buildinfo.GitCommit, config.Log.Debug, config.Log.Human)

	httpClient := &http.Client{}

	ipfs, err := httpapi.NewURLApiWithClient(config.IPFS.APIAddr, httpClient)
	if err != nil {
		log.Fatal().Err(err).Msg("creating ipfs client")
	}

	remoteIpfs, err := httpapi.NewURLApiWithClient(config.RemoteIPFS.APIAddr, httpClient)
	if err != nil {
		log.Fatal().Err(err).Msg("creating remote ipfs client")
	}
	remoteIpfs.Headers.Add("Authorization", "Basic "+basicAuth(config.RemoteIPFS.APIUser, config.RemoteIPFS.APIPass))

	fi, err := os.Stat(config.LayersPath)
	if err != nil {
		log.Fatal().Err(err).Msg("statting path to layers")
	}

	node, err := ipfsfiles.NewSerialFile(config.LayersPath, false, fi)
	if err != nil {
		log.Fatal().Err(err).Msg("creating searial file from path to layers")
	}

	fmt.Println("Adding layers to IPFS...")

	path, err := ipfs.Unixfs().Add(ctx, node, options.Unixfs.Pin(config.IPFS.Pin))
	if err != nil {
		log.Fatal().Err(err).Msg("adding images to ipfs")
	}

	if config.RemoteIPFS.Pin {
		fmt.Println("Pinning layers on remote IPFS...")
		if err := remoteIpfs.Pin().Add(ctx, path); err != nil {
			log.Fatal().Err(err).Msg("pinning path on remote ipfs")
		}
	}

	fmt.Printf("Layers loaded to IPFS with path %s\n", path.String())
}

func setupConfig() *config {
	conf := &config{}
	confFiles := uconfig.Files{
		{configFilename, json.Unmarshal},
	}

	c, err := uconfig.Classic(&conf, confFiles)
	if err != nil {
		if c != nil {
			c.Usage()
		}
		os.Exit(1)
	}

	return conf
}

func basicAuth(projectID, projectSecret string) string {
	auth := projectID + ":" + projectSecret
	return base64.StdEncoding.EncodeToString([]byte(auth))
}
