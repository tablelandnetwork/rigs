package main

import (
	"context"
	"fmt"
	"net/http"

	httpapi "github.com/ipfs/go-ipfs-http-client"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/internal/wpool"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/builder/randomness/system"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/util"
)

type config struct {
	SQLiteDBPath string `default:""`
	Layers       struct {
		Path           string `default:""`
		UseLocalLayers bool   `default:"false"`
	}
	IPFS struct {
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

	localLayersDir := ""
	if config.Layers.UseLocalLayers {
		localLayersDir = config.Layers.Path
	}

	b := builder.NewBuilder(s, ipfs, config.IPFS.GatewayURL, localLayersDir)

	buildExecFcn := func(opt builder.Option) wpool.ExecutionFn {
		return func(ctx context.Context) (interface{}, error) {
			rig, err := b.Build(ctx, opt)
			return rig, err
		}
	}

	originals, err := s.GetOriginalRigs(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("getting originals")
	}

	var jobs []wpool.Job
	for i, original := range originals {
		jobs = append(jobs, wpool.Job{
			ID: wpool.JobID(i + 1),
			ExecFn: buildExecFcn(
				builder.Original(i+1, original, system.NewSystemRandomnessSource())),
		})
	}

	pool := wpool.New(10)
	go pool.GenerateFrom(jobs)
	go pool.Run(ctx)
	for {
		select {
		case r, ok := <-pool.Results():
			if !ok {
				continue
			}
			if r.Err != nil {
				log.Error().Err(r.Err).Msgf("processing job %d", r.ID)
				continue
			}
			rig := r.Value.(*local.Rig)
			fmt.Printf("%d. %s\n", rig.ID, rig.Image)
		case <-pool.Done:
			return
		}
	}
}
