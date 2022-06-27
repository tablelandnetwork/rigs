package cmd

import (
	"context"
	"fmt"
	"path"
	"strings"

	"github.com/fatih/camelcase"
	"github.com/ipfs/go-cid"
	ipld "github.com/ipfs/go-ipld-format"
	core "github.com/ipfs/interface-go-ipfs-core"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/tablelandnetwork/nft-minter/pkg/builder"
	"github.com/tablelandnetwork/nft-minter/pkg/nullable"
	"github.com/tablelandnetwork/nft-minter/pkg/storage/local"
)

var parts = []local.Part{}
var layers = []local.Layer{}

func init() {
	localCmd.AddCommand(inventoryCmd)

	inventoryCmd.Flags().String("ipfs-layers-path", "", "ipfs path to the rigs layers images")
}

var inventoryCmd = &cobra.Command{
	Use:   "inventory",
	Short: "Populate the parts and layers tables from ipfs layers",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		checkErr(localStore.Reset(ctx))

		lcid, err := cid.Parse(viper.GetString("ipfs-layers-path"))
		checkErr(err)

		rootNode, err := ipfsClient.Dag().Get(ctx, lcid)
		checkErr(err)

		checkErr(processRootNode(ctx, ipfsClient, rootNode))

		checkErr(localStore.InsertParts(ctx, parts))

		checkErr(localStore.InsertLayers(ctx, layers))
	},
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

		if err := processFleetNode(ctx, api, n, fleetName, l.Name); err != nil {
			return fmt.Errorf("processing fleet node: %v", err)
		}
	}
	return nil
}

func processFleetNode(
	ctx context.Context,
	api core.CoreAPI,
	fleetNode ipld.Node,
	fleetName string,
	dirName string,
) error {
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
			path.Join(dirName, l.Name),
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
	dirName string,
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
			Path:     l.Cid.String(),
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
