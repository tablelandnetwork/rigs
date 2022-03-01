package main

import (
	"encoding/json"
	"os"

	"github.com/omeid/uconfig"
)

// configFilename is the filename of the config file automatically loaded.
var configFilename = "config.json"

type config struct {
	HTTP struct {
		Port    string `default:"5000"`
		Origins string `default:"http://localhost:3000"` // comma separated
	}
	Render struct {
		Concurrency int    `default:"20"`
		CacheDir    string `default:""` // if empty, images are cached in memory
	}
	Admin struct {
		Username string `default:"minter"`
		Password string `default:""`
	}
	GCP struct {
		SheetID               string `default:""`
		DriveFolderID         string `default:""`
		ServiceAccountKeyFile string `default:""`
	}
	Registry struct {
		EthEndpoint     string `default:"eth_endpoint"`
		ContractAddress string `default:"contract_address"`
	}
	Metrics struct {
		Port string `default:"5090"`
	}
	Log struct {
		Human bool `default:"false"`
		Debug bool `default:"false"`
	}
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
