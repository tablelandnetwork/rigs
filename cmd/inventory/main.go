package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/fatih/camelcase"
	"github.com/ipfs/go-cid"
	httpapi "github.com/ipfs/go-ipfs-http-client"
	ipld "github.com/ipfs/go-ipld-format"
	core "github.com/ipfs/interface-go-ipfs-core"
	"github.com/tablelandnetwork/nft-minter/pkg/minter"

	// _ "github.com/motemen/go-loghttp/global".

	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/common"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
	"github.com/tablelandnetwork/nft-minter/pkg/util"
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

var parts = []local.Part{}
var layers = []local.Layer{}

var configFilename = "config.json"

func main() {
	ctx := context.Background()

	config := &config{}
	util.SetupConfig(config, configFilename)
	logging.SetupLogger(buildinfo.GitCommit, config.Log.Debug, config.Log.Human)

	s, err := local.NewStore(config.SQLiteDBPath, true)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create local store")
	}
	defer func() {
		if err := s.Close(); err != nil {
			log.Err(err).Msg("closing store")
		}
	}()

	if err := s.CreateTables(ctx); err != nil {
		log.Fatal().Err(err).Msg("failed to create tables")
	}

	httpClient := &http.Client{}
	ipfs, err := httpapi.NewURLApiWithClient(config.IPFS.APIAddr, httpClient)
	if err != nil {
		log.Fatal().Err(err).Msg("creating ipfs client")
	}

	lcid, err := cid.Parse(config.IPFS.LayersPath)
	if err != nil {
		log.Fatal().Err(err).Msg("parsing layers path")
	}

	rootNode, err := ipfs.Dag().Get(ctx, lcid)
	if err != nil {
		log.Fatal().Err(err).Msg("getting node to read")
	}

	if err := processRootNode(ctx, ipfs, rootNode); err != nil {
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

func processRootNode(ctx context.Context, api core.CoreAPI, rootNode ipld.Node) error {
	entries := rootNode.Links()
	// Process each fleet dir.
	for _, l := range entries {
		n, err := l.GetNode(ctx, api.Dag())
		if err != nil {
			return fmt.Errorf("getting node: %v", err)
		}
		fleetName := displayString(l.Name)
		parts = append(parts, local.Part{
			Type: "Fleet",
			Name: fleetName,
		})

		if err := processFleetNode(ctx, api, n, fleetName); err != nil {
			return fmt.Errorf("processing fleet node: %v", err)
		}
	}
	return nil
}

func processFleetNode(ctx context.Context, api core.CoreAPI, fleetNode ipld.Node, fleetName string) error {
	processedParts := make(map[string]bool)
	entries := fleetNode.Links()
	for _, l := range entries {
		n, err := l.GetNode(ctx, api.Dag())
		if err != nil {
			return fmt.Errorf("getting node: %v", err)
		}

		parts := strings.Split(l.Name, "_")
		if len(parts) != 2 && len(parts) != 1 {
			return fmt.Errorf("expected one or two folder name parts but found %d", len(parts))
		}
		partTypeName := displayString(parts[0])

		processedParts, err = processPartTypeNode(
			n,
			fleetName,
			partTypeName,
			l.Name,
			processedParts,
		)
		if err != nil {
			return fmt.Errorf("processing part type node: %v", err)
		}
	}
	return nil
}

func processPartTypeNode(
	partTypeNode ipld.Node,
	fleetName string,
	partTypeName string,
	layerName string,
	processedParts map[string]bool,
) (map[string]bool, error) {
	entries := partTypeNode.Links()
	for _, l := range entries {
		if l.Name == ".DS_Store" {
			continue
		}

		filenameParts := strings.Split(l.Name, ".")
		if len(filenameParts) != 2 {
			return nil, fmt.Errorf("expected two file name parts but found %d: %s", len(filenameParts), l.Name)
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
			parts = append(parts, local.Part{
				Fleet:    common.NullableString{NullString: sql.NullString{String: fleetName, Valid: true}},
				Original: common.NullableString{NullString: sql.NullString{String: original, Valid: len(original) > 0}},
				Type:     partTypeName,
				Name:     name,
				Color:    common.NullableString{NullString: sql.NullString{String: color, Valid: true}},
			})
		}

		pos, err := minter.GetPosition(fleetName, layerName)
		if err != nil {
			return nil, fmt.Errorf("getting layer position: %v", err)
		}

		layers = append(layers, local.Layer{
			Fleet:    fleetName,
			Color:    color,
			PartName: name,
			PartType: partTypeName,
			Position: uint(pos),
			Path:     l.Cid.String(),
			// Path:     ipfspath.Join(partTypePath, l.Name).String(),
		})
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
