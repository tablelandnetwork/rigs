package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/fatih/camelcase"
	ipfsfiles "github.com/ipfs/go-ipfs-files"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	ipfspath "github.com/ipfs/interface-go-ipfs-core/path"

	// _ "github.com/motemen/go-loghttp/global"
	"github.com/omeid/uconfig"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/sqlite"
	"github.com/tablelandnetwork/nft-minter/minter"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
)

type config struct {
	SQLiteDBPath string `default:""`
	IPFS         struct {
		APIAddr    string `default:"http://127.0.0.1:5001"`
		LayersPath string `default:""`
	}
	Log struct {
		Human bool `default:"false"`
		Debug bool `default:"false"`
	}
}

var parts = []store.Part{}
var layers = []store.Layer{}

var configFilename = "config.json"

func main() {
	ctx := context.Background()

	config := setupConfig()
	logging.SetupLogger(buildinfo.GitCommit, config.Log.Debug, config.Log.Human)

	s, err := sqlite.NewSQLiteStore(config.SQLiteDBPath, true)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create sqlite store")
	}
	defer s.Close()

	if err := s.CreateTables(ctx); err != nil {
		log.Fatal().Err(err).Msg("failed to create tables")
	}

	httpClient := &http.Client{}
	ipfs, err := httpapi.NewURLApiWithClient(config.IPFS.APIAddr, httpClient)
	if err != nil {
		log.Fatal().Err(err).Msg("creating ipfs client")
	}

	path := ipfspath.New(config.IPFS.LayersPath)

	rootNode, err := ipfs.Unixfs().Get(ctx, path)
	if err != nil {
		log.Fatal().Err(err).Msg("getting node to read")
	}

	if err := processRootNode(rootNode.(ipfsfiles.Directory), path); err != nil {
		log.Fatal().Err(err).Msg("processing root directory")
	}

	if err := s.InsertParts(ctx, parts); err != nil {
		log.Fatal().Err(err).Msg("inserting parts")
	}

	// for _, part := range parts {
	// 	if err := s.InsertParts(ctx, []store.Part{part}); err != nil {
	// 		j, _ := json.MarshalIndent(part, "", "  ")
	// 		fmt.Println(string(j))
	// 		log.Fatal().Err(err).Msg("inserting part")
	// 	}
	// }

	if err := s.InsertLayers(ctx, layers); err != nil {
		log.Fatal().Err(err).Msg("inserting layers")
	}

	// for _, layer := range layers {
	// 	if err := s.InsertLayers(ctx, []store.Layer{layer}); err != nil {
	// 		j, _ := json.MarshalIndent(layer, "", "  ")
	// 		fmt.Println(string(j))
	// 		log.Fatal().Err(err).Msg("inserting layer")
	// 	}
	// }
}

func processRootNode(rootNode ipfsfiles.Directory, rootPath ipfspath.Path) error {
	entries := rootNode.Entries()
	// Process each fleet dir.
	for entries.Next() {
		dir, ok := entries.Node().(ipfsfiles.Directory)
		if !ok {
			continue
		}

		fleetName := displayString(entries.Name())
		parts = append(parts, store.Part{
			Type: "Fleet",
			Name: fleetName,
		})

		path := ipfspath.Join(rootPath, entries.Name())
		if err := processFleetNode(dir, path, fleetName); err != nil {
			return fmt.Errorf("processing fleet node: %v", err)
		}
	}
	if entries.Err() != nil {
		return fmt.Errorf("iterating root node entries: %v", entries.Err())
	}
	return nil
}

func processFleetNode(fleetNode ipfsfiles.Directory, fleetPath ipfspath.Path, fleetName string) error {
	fmt.Printf("Processing fleet: %s\n", fleetName)
	processedParts := make(map[string]bool)
	entries := fleetNode.Entries()
	for entries.Next() {
		dir, ok := entries.Node().(ipfsfiles.Directory)
		if !ok {
			continue
		}
		parts := strings.Split(entries.Name(), "_")
		if len(parts) != 2 && len(parts) != 1 {
			return fmt.Errorf("expected one or two folder name parts but found %d", len(parts))
		}

		partTypeName := displayString(parts[0])

		var err error
		processedParts, err = processPartTypeNode(
			dir,
			ipfspath.Join(fleetPath, entries.Name()),
			fleetName,
			partTypeName,
			entries.Name(),
			processedParts,
		)
		if err != nil {
			return fmt.Errorf("processing part type node: %v", err)
		}
	}
	if entries.Err() != nil {
		return fmt.Errorf("iterating fleet node entries: %v", entries.Err())
	}
	return nil
}

func processPartTypeNode(
	partTypeNode ipfsfiles.Directory,
	partTypePath ipfspath.Path,
	fleetName string,
	partTypeName string,
	layerName string,
	processedParts map[string]bool,
) (map[string]bool, error) {
	fmt.Printf("	Processing part type layer: %s\n", layerName)
	entries := partTypeNode.Entries()
	for entries.Next() {
		if _, ok := entries.Node().(ipfsfiles.File); !ok || entries.Name() == ".DS_Store" {
			continue
		}

		filenameParts := strings.Split(entries.Name(), ".")
		if len(filenameParts) != 2 {
			return nil, fmt.Errorf("expected two file name parts but found %d: %s", len(filenameParts), entries.Name())
		}
		prefixParts := strings.Split(filenameParts[0], "_")
		if len(prefixParts) != 3 {
			return nil, fmt.Errorf("expected 3 file name parts but found %d: %s", len(prefixParts), filenameParts[0])
		}

		original := displayString(prefixParts[0])
		color := displayString(prefixParts[1])
		name := displayString(prefixParts[2])

		partKey := fmt.Sprintf("%s|%s|%s", original, color, name)
		if _, processedPart := processedParts[partKey]; !processedPart {
			processedParts[partKey] = true
			parts = append(parts, store.Part{
				Fleet:    store.NullableString{NullString: sql.NullString{String: fleetName, Valid: true}},
				Original: store.NullableString{NullString: sql.NullString{String: original, Valid: len(original) > 0}},
				Type:     partTypeName,
				Name:     name,
				Color:    store.NullableString{NullString: sql.NullString{String: color, Valid: true}},
			})
		}

		pos, err := minter.GetPosition(fleetName, layerName)
		if err != nil {
			return nil, fmt.Errorf("getting layer position: %v", err)
		}

		layers = append(layers, store.Layer{
			Fleet:    fleetName,
			Part:     fmt.Sprintf("%s %s", color, name),
			Position: uint(pos),
			Path:     ipfspath.Join(partTypePath, entries.Name()).String(),
		})
		fmt.Printf("		Done processing part: %s|%s|%s|%s\n", fleetName, original, color, name)
	}
	if entries.Err() != nil {
		return nil, fmt.Errorf("iterating part type node entries: %v", entries.Err())
	}
	return processedParts, nil
}

func displayString(s string) string {
	final := strings.Join(camelcase.Split(s), " ")
	final = strings.ReplaceAll(final, " -", "-")
	final = strings.ReplaceAll(final, "- ", "-")
	final = strings.ReplaceAll(final, "Base 58", "Base58")
	final = strings.ReplaceAll(final, "MD 4", "MD4")
	final = strings.ReplaceAll(final, "MD 5", "MD5")
	final = strings.ReplaceAll(final, "SHA 256", "SHA256")
	final = strings.ReplaceAll(final, "Ed DSA", "EdDSA")
	final = strings.ReplaceAll(final, "S Po F", "SPoF")
	final = strings.ReplaceAll(final, "M 2", "M2")
	return final
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
