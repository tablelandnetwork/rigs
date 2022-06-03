package util

import (
	"encoding/base64"
	"encoding/json"
	"os"

	"github.com/omeid/uconfig"
)

// SetupConfig sets up the provided config struct reference.
func SetupConfig(conf interface{}, configFilename string) {
	confFiles := uconfig.Files{
		{configFilename, json.Unmarshal},
	}

	c, err := uconfig.Classic(conf, confFiles)
	if err != nil {
		if c != nil {
			c.Usage()
		}
		os.Exit(1)
	}
}

// BasicAuthString returns the basic auth header value.
func BasicAuthString(user, pass string) string {
	auth := user + ":" + pass
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(auth))
}
