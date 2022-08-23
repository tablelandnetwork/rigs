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

The `artifacts/` folder contains some build input and output that could be useful for those interesetd in inpecting or extending Rigs.
- `layers/` - The raw layer folders and images of Rig parts that all Rigs data and imagery was built from
- `local.db` - SQLite database of built Rigs data that was used to publish the official Rigs NFT collection to Tableland using the CLI
- `tableland.db` -  SQLite representation of the official Rigs NFT collection stored on Tableland

# The Rigs CLI

## Buid and Install

The Rigs CLI executable can be built by running `make build-rigs` or `go build ./cmd/rigs/`. The resulting executable will end up in the root of the repo working directory. If you want to install it into your `$PATH` using a properly configured Go installation, use `go instsall ./cmd/rigs`.

## Running the CLI

The CLI was used to build and publish the Rigs NFT collection. The CLI is used generally in two different modes, "local" and "publish". The idea is to build Rigs data and imagery locally, perform any inspection and QA on the results, and then publish the resulting data and imagery to Tableland and IPFS.

CLI commands have reasonable defaults for most parameters, but you can customize many settings by using command flags or environment variables. For example, a flag name of `--my-flag` could be set using the environment variable `RIGS_MY_FLAG` (all environment variables must be prefixed with `RIGS_`).

See documentation for any command by calling the command with the `--help` flag.

### Local mode

In order to build a rigs dataset from scratch, the first step is to build the Rigs "inventory". This is the raw data derived from `artifacts/layers`, stored by default in `local.db`, that serves as the building blocks for Rigs data and imagery.

```
rigs local inventory
```

This will create `local.db` and populate the `parts` and `layers` tables with data.

The next step is to build some actual Rigs data:

```
rigs local build 200 --no-originals
```

This builds 200 random Rigs, storing the data in the `rigs` and `rig_parts` tables of `local.db`. Providing the `--no-orginials` flag means none of the 





## License

[MIT](LICENSE)
