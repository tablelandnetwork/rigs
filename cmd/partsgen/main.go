package main

import (
	"context"
	"database/sql"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/fatih/camelcase"
	"github.com/rs/zerolog/log"
	"github.com/tablelandnetwork/nft-minter/buildinfo"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store"
	"github.com/tablelandnetwork/nft-minter/internal/staging/tableland/store/sqlite"
	"github.com/tablelandnetwork/nft-minter/pkg/logging"
)

type FleetName string
type LayerName string
type Order int
type LayerGuide map[FleetName]map[LayerName]Order

var layerGuide = LayerGuide{
	"Titans": {
		"Background":     0,
		"Chassis_Bottom": 1,
		"Chassis_Back":   2,
		"UtilityPack":    3,
		"Mainframe":      4,
		"Cab":            5,
		"Chassis_Front":  6,
		"Mod":            7,
	},
	"Tumblers": {
		"Background":       0,
		"Suspension_Back":  1,
		"UtilityPack":      2,
		"Core":             3,
		"Suspension_Front": 4,
		"Cockpit":          5,
	},
	"Sleds": {
		"Background":     0,
		"Chassis_Shadow": 1,
		"Chassis_Main":   2,
		"Spoiler":        3,
		"Monocoque":      4,
		"Bonnett":        5,
		"Mod":            6,
	},
	"EdgeRiders": {
		"Background":   0,
		"Mod_SideBack": 1,
		"Frame":        2,
		"Mod_Back":     3,
		"Rider":        4,
		"Cockpit":      5,
		"Mod_Side":     6,
	},
	"Tracers": {
		"Background":    0,
		"Mod_Back":      1,
		"Mod_Front":     2,
		"Chassis_Back":  3,
		"Cockpit_Back":  4,
		"Propulsion":    5,
		"Chassis_Front": 6,
		"Cockpit_Front": 7,
	},
	"Hoppers": {
		"Background":       0,
		"Mod":              1,
		"Propulsion_Back":  2,
		"Chassis":          3,
		"Cockpit":          4,
		"Propulsion_Front": 5,
		"Propulsion_Top":   6,
	},
	"Airelights": {
		"Background":       0,
		"Propulsion_Back":  1,
		"Airframe":         2,
		"Cockpit":          3,
		"Propulsion_Front": 4,
	},
	"Foils": {
		"Background": 0,
		"Airframe":   1,
		"Propulsion": 2,
		"Cockpit":    3,
	},
}

var distributions = []store.Distribution{
	{PartType: "Fleet", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Titans", Valid: true}}, PartType: "Chassis", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Titans", Valid: true}}, PartType: "Mainframe", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Titans", Valid: true}}, PartType: "Cab", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Titans", Valid: true}}, PartType: "Utility Pack", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Titans", Valid: true}}, PartType: "Mod", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Titans", Valid: true}}, PartType: "Background", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tumblers", Valid: true}}, PartType: "Suspension", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tumblers", Valid: true}}, PartType: "Cockpit", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tumblers", Valid: true}}, PartType: "Utility Pack", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tumblers", Valid: true}}, PartType: "Core", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tumblers", Valid: true}}, PartType: "Background", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Sleds", Valid: true}}, PartType: "Monocoque", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Sleds", Valid: true}}, PartType: "Mod", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Sleds", Valid: true}}, PartType: "Bonnet", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Sleds", Valid: true}}, PartType: "Chassis", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Sleds", Valid: true}}, PartType: "Spoiler", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Sleds", Valid: true}}, PartType: "Background", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Edge Riders", Valid: true}}, PartType: "Mod", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Edge Riders", Valid: true}}, PartType: "Cockpit", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Edge Riders", Valid: true}}, PartType: "Frame", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Edge Riders", Valid: true}}, PartType: "Rider", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Edge Riders", Valid: true}}, PartType: "Background", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tracers", Valid: true}}, PartType: "Background", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tracers", Valid: true}}, PartType: "Chassis", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tracers", Valid: true}}, PartType: "Cockpit", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tracers", Valid: true}}, PartType: "Propulsion", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Tracers", Valid: true}}, PartType: "Mod", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Hoppers", Valid: true}}, PartType: "Propulsion", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Hoppers", Valid: true}}, PartType: "Cockpit", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Hoppers", Valid: true}}, PartType: "Mod", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Hoppers", Valid: true}}, PartType: "Chassis", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Hoppers", Valid: true}}, PartType: "Background", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Airelights", Valid: true}}, PartType: "Background", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Airelights", Valid: true}}, PartType: "Airframe", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Airelights", Valid: true}}, PartType: "Cockpit", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Airelights", Valid: true}}, PartType: "Propulsion", Distribution: "lin"},

	{Fleet: store.NullableString{NullString: sql.NullString{String: "Foils", Valid: true}}, PartType: "Background", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Foils", Valid: true}}, PartType: "Airframe", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Foils", Valid: true}}, PartType: "Propulsion", Distribution: "lin"},
	{Fleet: store.NullableString{NullString: sql.NullString{String: "Foils", Valid: true}}, PartType: "Cockpit", Distribution: "lin"},
}

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

	rootPath := filepath.Join(home, "Dropbox/Tableland/NFT/NFT_Delivery/")

	if err := processRootDir(rootPath); err != nil {
		log.Fatal().Err(err).Msg("processing root directory")
	}

	if err := s.InsertParts(ctx, parts); err != nil {
		log.Fatal().Err(err).Msg("inserting parts")
	}

	// for _, part := range parts {
	// 	if err := s.InsertPart(ctx, part); err != nil {
	// 		j, _ := json.MarshalIndent(part, "", "  ")
	// 		fmt.Println(string(j))
	// 		log.Fatal().Err(err).Msg("inserting part")
	// 	}
	// }

	if err := s.InsertLayers(ctx, layers); err != nil {
		log.Fatal().Err(err).Msg("inserting layers")
	}

	// for _, layer := range layers {
	// 	if err := s.InsertLayer(ctx, layer); err != nil {
	// 		j, _ := json.MarshalIndent(layer, "", "  ")
	// 		fmt.Println(string(j))
	// 		log.Fatal().Err(err).Msg("inserting layer")
	// 	}
	// }

	if err := s.InsertDistributions(ctx, distributions); err != nil {
		log.Fatal().Err(err).Msg("inserting distributions")
	}

	// for _, dist := range distributions {
	// 	if err := s.InsertDistribution(ctx, dist); err != nil {
	// 		j, _ := json.MarshalIndent(dist, "", "  ")
	// 		fmt.Println(string(j))
	// 		log.Fatal().Err(err).Msg("inserting distribution")
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
		_, name, err := parseTopLevelDirName(file.Name())
		if err != nil {
			return err
		}
		if name == "Backgrounds" {
			continue
		}
		parts = append(parts, store.Part{
			Type: "Fleet",
			Name: displayString(name),
		})
	}

	// Process each fleet dir.
	for _, file := range files {
		if !file.IsDir() {
			continue
		}
		_, name, err := parseTopLevelDirName(file.Name())
		if err != nil {
			log.Fatal().Err(err).Msg(fmt.Sprintf("failed to parse top level dir name %s", file.Name()))
		}

		if name == "Backgrounds" {
			continue
		}

		if err := processFleetDir(name, rootPath, file.Name()); err != nil {
			log.Fatal().Err(err).Msg("processing fleet dir")
		}
	}
	return nil
}

func parseTopLevelDirName(s string) (int, string, error) {
	vals := strings.Split(s, "_")
	if len(vals) != 2 {
		return 0, "", fmt.Errorf("expected two dir name parts but found %d", len(vals))
	}
	index, err := strconv.Atoi(vals[0])
	if err != nil {
		return 0, "", err
	}
	return index, vals[1], nil
}

func processFleetDir(fleetName string, rootPath string, basePath string) error {
	files, err := ioutil.ReadDir(filepath.Join(rootPath, basePath, "Parts"))
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

		part := parts[0]

		processedParts, err = processPartDir(
			fleetName,
			part,
			file.Name(),
			rootPath,
			filepath.Join(basePath, "Parts", file.Name()),
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
			return nil, fmt.Errorf("expected three file name parts but found %d: %s", len(prefixParts), filenameParts[0])
		}

		original := prefixParts[0]
		color := prefixParts[1]
		name := prefixParts[2]

		partKey := fmt.Sprintf("%s|%s|%s", original, color, name)
		if _, processedPart := processedParts[partKey]; !processedPart {
			processedParts[partKey] = true
			parts = append(parts, store.Part{
				Fleet:    store.NullableString{NullString: sql.NullString{String: displayString(fleetName), Valid: true}},
				Original: store.NullableString{NullString: sql.NullString{String: displayString(original), Valid: len(original) > 0}},
				Type:     displayString(partType),
				Name:     displayString(name),
				Color:    store.NullableString{NullString: sql.NullString{String: displayString(color), Valid: true}},
			})
		}

		layers = append(layers, store.Layer{
			Fleet:     displayString(fleetName),
			PartName:  displayString(name),
			PartColor: displayString(color),
			Position:  uint(layerGuide[FleetName(fleetName)][LayerName(layerName)]),
			Path:      filepath.Join(basePath, file.Name()),
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
