[![GitHub license](https://img.shields.io/github/license/tablelandnetwork/rigs.svg?style=popout-square)](./LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/tablelandnetwork/rigs?style=flat-square)](https://goreportcard.com/report/github.com/tablelandnetwork/rigs?style=flat-square)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=popout-square)](https://github.com/RichardLitt/standard-readme)

# Rigs

> Generate, render, inspect and publish Rigs NFT data and imagery.

## Getting Started

The main tool included here is the `rigs` CLI in the `cmd/rigs` directorory. It provides commands to randomly generate rigs data, render the imagery for that data, view the results in a web app, and publish both the data and imagery to Tableland and IPFS.

Run `make build-rigs` to build the `rigs` executable and run `rigs --help` or provide the `--help` flag to any sub command to learn more about the commands available. All command flags can be set via environmant variables. Evnironmant variable names must be prepended with `RIGS_` and relate to the flag name this way: `--flag-name` -> `RIGS_FLAG_NAME`.

## License

[MIT](LICENSE)
