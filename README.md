# @tableland/rigs

[![GitHub license](https://img.shields.io/github/license/tablelandnetwork/rigs.svg)](./LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/tablelandnetwork/rigs.svg)](./package.json)
[![Release](https://img.shields.io/github/release/tablelandnetwork/rigs.svg)](https://github.com/tablelandnetwork/rigs/releases/latest)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

![Tests](https://github.com/tablelandnetwork/rigs/workflows/Test/badge.svg)

> Tableland Rigs contract and client components

# Table of Contents

- [Background](#background)
- [Development](#development)
- [License](#license)

# Background

This is the Tableland Rigs contract and client components.

# Development

## Building the client

You can build the Typescript client locally:

```shell
npm install
npx hardhat compile
npm run build
```

## Testing

Run the test suite:

```shell
npm test
```

Test with gas reporting:

```shell
REPORT_GAS=true npx hardhat test
```

## Deploying

Deployments are handled on a per-network basis:

```shell
npx hardhat run scripts/deploy.ts --network optimism
```

Refer to the `deployments` entry in `hardhat.config.js` for the list of current deployments.

## Extacting the ABI and Bytecode

You can you grab the assets you need by compiling and then using some `jq` magic:

### ABI

```shell
cat artifacts/contracts/TablelandRigs.sol/TablelandRigs.json | jq '.abi' > abi.json
```

### Bytecode

```shell
cat artifacts/contracts/TablelandRigs.sol/TablelandRigs.json | jq -r '.bytecode' > bytecode.bin
```

### Generate the Go client!

You can use the above `abi.json` to build the Go client:

```shell
mkdir gobuild
abigen --abi ./abi.json --bin ./bytecode.bin --pkg contracts --out gobuild/TablelandRigs.go
```

# License

MIT AND Apache-2.0, © 2021-2022 Tableland Network Contributors
