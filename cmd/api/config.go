package main

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
	IPFS struct {
		APIAddr    string `default:"http://127.0.0.1:5001"`
		GatewayURL string `default:"http://127.0.0.1:8080"`
	}
	Metrics struct {
		Port string `default:"5090"`
	}
	Log struct {
		Human bool `default:"false"`
		Debug bool `default:"false"`
	}
}
