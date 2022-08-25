[![GitHub license](https://img.shields.io/github/license/tablelandnetwork/rigs.svg?style=popout-square)](./LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/tablelandnetwork/rigs?style=flat-square)](https://goreportcard.com/report/github.com/tablelandnetwork/rigs?style=flat-square)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=popout-square)](https://github.com/RichardLitt/standard-readme)

# Rigs

> Tableland Rigs tooling and contract.

# Repo Layout

This repo contains various components of the Rigs tooling and smart contracts. Some important landmarks are:
- `artifacts/` - Various artifacts used as input to the Rigs building process as well as the resulting SQLite data
- `cmd/` - A Go CLI implementation for building and publishing Rigs data and imagery
- `pkg/` - Backing Go packages used by the CLI implementation
- `viewer/` - A Nuxt.js app used by the CLI for viewing built Rigs data locally
- `ethereum/` - The Rigs smart contract

# Artifacts

The `artifacts/` folder contains some build input and output that could be useful for those interested in inspecting or extending Rigs.
- `layers/` - The raw layer folders and images of Rig parts that all Rigs data and imagery was built from
- `local.db` - SQLite database of built Rigs data that was used to publish the official Rigs NFT collection to Tableland using the CLI
- `tableland.db` -  SQLite representation of the official Rigs NFT collection stored on Tableland

# The Rigs CLI

## Build and Install

The Rigs CLI executable can be built by running `make build-rigs` or `go build ./cmd/rigs/`. The resulting executable will end up in the root of the repo working directory. If you want to install it into your `$PATH` using a properly configured Go installation, use `go instsall ./cmd/rigs`.

## Running the CLI

The CLI was used to build and publish the Rigs NFT collection. The CLI is used generally in two different modes, "local" and "publish". The idea is to build Rigs data and imagery locally, perform any inspection and QA on the results, and then publish the resulting data and imagery to Tableland and IPFS.

CLI commands have reasonable defaults for most parameters, but you can customize many settings by using command flags or environment variables. For example, a flag name of `--my-flag` could be set using the environment variable `RIGS_MY_FLAG` (all environment variables must be prefixed with `RIGS_`).

See documentation for any command by calling the command with the `--help` flag.

### Local Mode

To build a Rigs dataset from scratch, the first step is to build the Rigs "inventory". This is the raw data derived from `artifacts/layers`, stored by default in `local.db`, that serves as the building blocks for Rigs data and imagery.

```
> rigs local inventory
```

This will create `local.db` and populate the `parts` and `layers` tables with data.

The next step is to build some actual Rigs data:

```
> rigs local build 200 --no-originals
```

This builds 200 random Rigs, reading from the `parts` and `layers` tables, and storing the resulting data in the `rigs` and `rig_parts` tables of `local.db`. Providing the `--no-orginials` flag means none of the original Rigs (Rigs with all parts from the same original and of matching color).

You can view some basic statistics about the built Rigs data using the `stats` command.

```
> rigs local stats

...

Fleet Distribution:
        Foils           3       1.5% (2.8%) 
        Hoppers         15      7.5% (8.3%) 
        Edge Riders     18      9.0% (13.9%) 
        Tracers         20      10.0% (11.1%) 
        Airelights      25      12.5% (5.6%) ***
        Sleds           33      16.5% (16.7%) 
        Titans          41      20.5% (22.2%) 
        Tumblers        45      22.5% (19.4%)

...
```

Now that our Rigs data is built, we can render the corresponding images for all the Rigs.

```
> rigs local render
```

The resulting images will be written to a folder called `./renders`. Each subfolder name corresponds to a Rig ID and inside each Rig ID folder are the four images created for the Rig.

```
> ls ./renders/1/
image.png        image_alpha.png  thumb.png        thumb_alpha.png
```

You can launch a simple local web app to view the results. 

```
> rigs local view
```

![The local Rigs viewer web app](artifacts/viewer.jpg)

### Publish Mode

Now that we've built our Rigs data and imagery locally, we're ready to publish the imagery to IPFS (via [NFT.storage](https://nft.storage)) and data to Tableland.

> **Note**
> Pusing the Rig images to NFT.storage requires a local [IPFS](https://ipfs.tech) node to be running. The easiest way to do that is using [IPFS Desktop](https://github.com/ipfs/ipfs-desktop). The default settings for the CLI will use the locally running IPFS node's default settings, but you can always customize the connection infomation using the `--ipfs-api-url` flag.

We'll first push the Rigs images to NFT.storage.

```
> rigs publish images
2022/08/24 20:50:00 Adding folder to IPFS...

...

Images published with CID bafybeiffjkwh6jndds6mvkflhxgkpod3fvc7esaueabn5j6jva5wnw5zhm
```

> **Note**
> Pushing imagery to NFT.storage requires you pass a NFT.storate API key using the `--nft-storage-key` flag. In this example, it has be set using the `RIGS_NFT_STORAGE_KEY` environment variable.

The resulting CID is tracked in `local.db`'s `cids` table and used in an upcoming step to write the Rigs data to Tableland. Before we can do that, we must first create the tables that will hold our Rigs and attributes data on Tableland.

```
> rigs publish schema --rigs --attrs --to-tableland
created table rigs_80001_1217
created table rig_attributes_80001_1218
```

The `--attrs` and `--rigs` flags specify that we want to create the tables to hold the Rigs and their attributes. The names of the resulting tables are tracked in `local.db`'s table called `table_names`.

> **Note**
> All write interactions with Tableland (creating and writing to tables) must provide a private key hex string using the `--private-key` flag as well as an EVM backend provider API key using the `--infura` or `--alchemy` flags. In these examples, you can assume the flags were set using the corresponding environment variables `RIGS_PRIVATE_KEY` and `RIGS_INFURA` or `RIGS_ALCHEMY`.

Now we can write our Rigs data to those Tableland tables. The following command transforms our built Rigs data stored in `local.db` into the appropriate SQL statements to populate the Tableland tables, and then executes those SQL statements using Tableland's [Go client](https://pkg.go.dev/github.com/textileio/go-tableland/pkg/client).

```
> rigs publish data --rigs --attrs --to-tableland
processed job 4. rig attrs offset 0
processed job 1. rigs with offset 0
processed job 2. rigs with offset 70
processed job 3. rigs with offset 140
processed job 5. rig attrs offset 70
processed job 6. rig attrs offset 140
done
```

> **Note**
> The above to commands to create and write to the Rigs tables include the `--to-tableland` flag. This flag directs the CLI to interact with the actual Tableland network, and if omitted, the CLI will instead execute the same SQL statement against a local SQLite database file called `tableland.db`. This is useful to perform a "dry run" of publishing the Rigs data and allows inspection of the local SQLite database.

Now that all of our imagery is stored on IPFS and Rigs data written to Tableland, we can integrate it into the Rigs smart contract.

# The Rigs Smart Contract

Coming soon.

## License

[MIT](LICENSE)
