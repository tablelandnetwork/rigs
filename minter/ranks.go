package minter

import (
	"fmt"
)

type rankCategory string
type rankItem string
type rank int
type partRank map[rankCategory]map[rankItem]rank

var partRanks = partRank{
	"Fleets": {
		// 66 styles, 181 originals
		"Foils":       18, // 6 styles, 18 originals
		"Tracers":     19, // 6 styles, 19 originals
		"Sleds":       19, // 8 styles, 19 originals
		"Airelights":  21, // 8 styles, 21 originals
		"Edge Riders": 24, // 10 styles, 24 originals
		"Hoppers":     25, // 8 styles, 25 originals
		"Tumblers":    27, // 9 styles, 27 originals
		"Titans":      28, // 11 styles, 28 originals
		// "Airelights":  1, // 8 styles, 21 originals
		// "Foils":       1, // 6 styles, 18 originals
		// "Tracers":     2, // 6 styles, 19 originals
		// "Hoppers":     2, // 8 styles, 25 originals
		// "Sleds":       3, // 8 styles, 19 originals
		// "Edge Riders": 3, // 10 styles, 24 originals
		// "Titans":      4, // 11 styles, 28 originals
		// "Tumblers":    4, // 9 styles, 27 originals
	},
	"Foils": {
		// 3 colors
		"Solar Scarab":  1,
		"Hydro Wasp":    2,
		"Stark Tangler": 3,
		"The Cricket":   4,
		"G-Nat":         5,
		"The Messenger": 6,
	},
	"Tracers": {
		// 2 colors
		"Vapor Jet": 1,
		// 3 colors
		"Sand Splitter":  2,
		"Hash Grappler":  3,
		"Herculean Twin": 4,
		// 4 colors
		"Skipjack Thunderbolt": 5,
		"Grohl":                6,
	},
	"Sleds": {
		// 2 colors
		"The Circuit": 1,
		"Steamwing":   2,
		"Skelebit":    3,
		"Darkmatter":  4,
		"Speedcube":   5,
		"Swiftbeak":   6,
		// 3 colors
		"Decrypter": 7,
		// 4 colors
		"Waveracer": 8,
	},
	"Airelights": {
		// 2 colors
		"Cloudlifter": 1,
		"The Monitor": 2,
		"Sand Cipher": 3,
		// 3 colors
		"Dune Swallow":   4,
		"Skycrane":       5,
		"Quantum Whiff":  6,
		"The Alpensquab": 7,
		"The Orca":       8,
	},
	"Edge Riders": {
		// 2 colors
		"Du Vallion Loop": 1,
		"Hex Interceptor": 2,
		"Radio Fang":      3,
		"Ledgerette":      4,
		"Tablelancer":     5,
		"Hodlbolt M2":     6,
		"Merk Cracker":    7,
		// 3 colors
		"Holofox":    8,
		"Salt Skiff": 9,
		// 4 colors
		"Gwei Jumper": 10,
	},
	"Hoppers": {
		// 2 colors
		"The Canyonlander": 1,
		// 3 colors
		"Block Explorer": 2,
		"Stealth Node":   3,
		"Rownum Candle":  4,
		"Claim Jumper":   5,
		"Steaming Eagle": 6,
		// 4 colors
		"Bit Shifter":    7,
		"Fusion Scooter": 8,
	},
	"Tumblers": {
		// 3 colors
		"Ski Piggy":       1,
		"Steam Surger":    2,
		"Sonic Scribe":    3,
		"The Witness":     4,
		"Drillseeker":     5,
		"Mercy Mayhem":    6,
		"Lug Tug":         7,
		"Cipher Smuggler": 8,
		"Grid Piercer":    9,
	},
	"Titans": {
		// 0 colors
		"Circuit Sled": 1,
		// 2 colors
		"Sentry Buggy":  2,
		"The Sniffer":   3,
		"The Delica":    4,
		"Cyclic Tooler": 5,
		// 3 colors
		"Solar Tank":   6,
		"Heavy Medler": 7,
		"Flux Blaster": 8,
		"Rockbiter":    9,
		// 4 colors
		"Cyber Train":      10,
		"Thriller Driller": 11,
	},
	"Backgrounds": {
		"Dark":      1,
		"Desat":     2,
		"Hue Shift": 3,
		"Main":      4,
	},
	"Riders": {
		"Midnight":  1,
		"Moonlight": 1,
		"Sunset":    1,
	},
}

// GetRank returns the rank for the provided category and item.
func GetRank(category string, item string) (int, error) {
	if rank, ok := partRanks[rankCategory(category)][rankItem(item)]; ok {
		return int(rank), nil
	}
	return 0, fmt.Errorf("no rank found for category %s, item %s", category, item)
}
