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
	IPFS struct {
		APIAddr string `default:"http://127.0.0.1:5001"`
		Pin     bool   `default:"false"`
	}
	RemoteIPFS struct {
		APIAddr string `default:"https://ipfs.infura.io:5001"`
		APIUser string `default:""`
		APIPass string `default:""`
		Pin     bool   `default:"false"`
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
