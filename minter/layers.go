package minter

import "fmt"

type fleetName string
type layerName string
type order int
type layerGuide map[fleetName]map[layerName]order

var layers = layerGuide{
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
		"Bonnet":         5,
		"Mod":            6,
	},
	"Edge Riders": {
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
		"Propulsion_Top":   5,
	},
	"Foils": {
		"Background": 0,
		"Airframe":   1,
		"Propulsion": 2,
		"Cockpit":    3,
	},
}

// GetPosition returns the position of specified fleet and layer.
func GetPosition(fleet string, layer string) (int, error) {
	if rank, ok := layers[fleetName(fleet)][layerName(layer)]; ok {
		return int(rank), nil
	}
	return 0, fmt.Errorf("no layer position found for fleet %s, layer %s", fleet, layer)
}
