package main

import (
	"context"
	"database/sql"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/fatih/camelcase"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/sqlite"
	"github.com/tablelandnetwork/nft-minter/minter"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
)

var parts = []store.Part{}
var layers = []store.Layer{}

func main() {
	// TODO: Use a config struct that gets set up here.
	logging.SetupLogger(buildinfo.GitCommit, true, true)

	s, err := sqlite.NewSQLiteStore("./parts.db", true)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create sqlite store")
	}
	defer s.Close()

	ctx := context.Background()

	if err := s.CreateTables(ctx); err != nil {
		log.Fatal().Err(err).Msg("failed to create tables")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatal().Err(err).Msg("getting home dir")
	}

	rootPath := filepath.Join(home, "Dropbox/Tableland/NFT/Fleets")
	// rootPath := filepath.Join(home, "tmp")

	if err := processRootDir(rootPath); err != nil {
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

func processRootDir(rootPath string) error {
	files, err := ioutil.ReadDir(rootPath)
	if err != nil {
		return err
	}

	// Add the fleets to our parts list.
	for _, file := range files {
		if !file.IsDir() {
			continue
		}

		name := displayString(file.Name())

		parts = append(parts, store.Part{
			Type: "Fleet",
			Name: name,
		})
	}

	// Process each fleet dir.
	for _, file := range files {
		if !file.IsDir() {
			continue
		}
		if err := processFleetDir(displayString(file.Name()), rootPath, file.Name()); err != nil {
			log.Fatal().Err(err).Msg("processing fleet dir")
		}
	}
	return nil
}

func processFleetDir(fleetName string, rootPath string, basePath string) error {
	files, err := ioutil.ReadDir(filepath.Join(rootPath, basePath))
	if err != nil {
		return err
	}
	processedParts := make(map[string]bool)
	for _, file := range files {
		if !file.IsDir() {
			continue
		}
		parts := strings.Split(file.Name(), "_")
		if len(parts) != 2 && len(parts) != 1 {
			return fmt.Errorf("expected one or two folder name parts but found %d", len(parts))
		}

		part := displayString(parts[0])

		processedParts, err = processPartDir(
			fleetName,
			part,
			file.Name(),
			rootPath,
			filepath.Join(basePath, file.Name()),
			processedParts,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func processPartDir(
	fleetName string,
	partType string,
	layerName string,
	rootPath string,
	basePath string,
	processedParts map[string]bool,
) (map[string]bool, error) {
	files, err := ioutil.ReadDir(filepath.Join(rootPath, basePath))
	if err != nil {
		return nil, err
	}
	for _, file := range files {
		if file.IsDir() || file.Name() == ".DS_Store" {
			continue
		}
		filenameParts := strings.Split(file.Name(), ".")
		if len(filenameParts) != 2 {
			return nil, fmt.Errorf("expected two file name parts but found %d: %s", len(filenameParts), file.Name())
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
				Type:     partType,
				Name:     name,
				Color:    store.NullableString{NullString: sql.NullString{String: color, Valid: true}},
			})
		}

		pos, err := minter.GetPosition(fleetName, layerName)
		if err != nil {
			return nil, err
		}

		layers = append(layers, store.Layer{
			Fleet:    fleetName,
			Part:     fmt.Sprintf("%s %s", color, name),
			Position: uint(pos),
			Path:     filepath.Join(basePath, file.Name()),
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
