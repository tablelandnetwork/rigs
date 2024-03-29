package cmd

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/fatih/camelcase"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/rigs/pkg/builder"
	"github.com/tablelandnetwork/rigs/pkg/nullable"
	"github.com/tablelandnetwork/rigs/pkg/storage/local"
)

var (
	parts  = []local.Part{}
	layers = []local.Layer{}
)

func init() {
	localCmd.AddCommand(inventoryCmd)

	inventoryCmd.Flags().String("layers-path", "./artifacts/layers", "path to the rigs layers images")
}

var inventoryCmd = &cobra.Command{
	Use:   "inventory",
	Short: "Populate the parts and layers tables from layers folder",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()
		checkErr(localStore.Reset(ctx))
		checkErr(processRootNode(viper.GetString("layers-path")))
		checkErr(localStore.InsertParts(ctx, parts))
		checkErr(localStore.InsertLayers(ctx, layers))
	},
}

func processRootNode(rootPath string) error {
	entries, err := os.ReadDir(rootPath)
	if err != nil {
		return err
	}
	// Process each fleet dir.
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		fleetName := displayString(e.Name())
		parts = append(parts, local.Part{
			Type: "Fleet",
			Name: fleetName,
		})

		if err := processFleetNode(fleetName, rootPath, e.Name()); err != nil {
			return fmt.Errorf("processing fleet node: %v", err)
		}
	}
	return nil
}

func processFleetNode(
	fleetName string,
	rootPath string,
	relativePath string,
) error {
	processedParts := make(map[string]bool)
	entries, err := os.ReadDir(path.Join(rootPath, relativePath))
	if err != nil {
		return err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		parts := strings.Split(e.Name(), "_")
		if len(parts) != 2 && len(parts) != 1 {
			return fmt.Errorf("expected one or two folder name parts but found %d", len(parts))
		}
		partTypeName := displayString(parts[0])

		processedParts, err = processPartTypeNode(
			fleetName,
			partTypeName,
			e.Name(),
			processedParts,
			rootPath,
			path.Join(relativePath, e.Name()),
		)
		if err != nil {
			return fmt.Errorf("processing part type node: %v", err)
		}
	}
	return nil
}

func processPartTypeNode(
	fleetName string,
	partTypeName string,
	layerName string,
	processedParts map[string]bool,
	rootPath string,
	relativePath string,
) (map[string]bool, error) {
	entries, err := os.ReadDir(path.Join(rootPath, relativePath))
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if e.Name() == ".DS_Store" {
			continue
		}

		filenameParts := strings.Split(e.Name(), ".")
		if len(filenameParts) != 2 {
			return nil, fmt.Errorf("expected two file name parts but found %d: %s", len(filenameParts), e.Name())
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
				Fleet:    nullable.FromString(fleetName),
				Original: nullable.FromString(original, nullable.EmptyIsNull()),
				Type:     partTypeName,
				Name:     name,
				Color:    nullable.FromString(color),
			})
		}

		pos, err := builder.GetPosition(fleetName, layerName)
		if err != nil {
			return nil, fmt.Errorf("getting layer position: %v", err)
		}

		layers = append(layers, local.Layer{
			Fleet:    fleetName,
			Color:    color,
			PartName: name,
			PartType: partTypeName,
			Position: uint(pos),
			Path:     path.Join(relativePath, e.Name()),
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
