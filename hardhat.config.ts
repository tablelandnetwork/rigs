import * as dotenv from "dotenv";

import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
    only: [],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  networks: {
    // mainnets
    ethereum: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${
        process.env.ETHEREUM_API_KEY ?? ""
      }`,
      accounts:
        process.env.ETHEREUM_PRIVATE_KEY !== undefined
          ? [process.env.ETHEREUM_PRIVATE_KEY]
          : [],
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${
        process.env.OPTIMISM_API_KEY ?? ""
      }`,
      accounts:
        process.env.OPTIMISM_PRIVATE_KEY !== undefined
          ? [process.env.OPTIMISM_PRIVATE_KEY]
          : [],
    },
    // testnets
    "ethereum-goerli": {
      url: `https://eth-goerli.alchemyapi.io/v2/${
        process.env.ETHEREUM_GOERLI_API_KEY ?? ""
      }`,
      accounts:
        process.env.ETHEREUM_GOERLI_PRIVATE_KEY !== undefined
          ? [process.env.ETHEREUM_GOERLI_PRIVATE_KEY]
          : [],
    },
    "optimism-kovan": {
      url: `https://opt-kovan.g.alchemy.com/v2/${
        process.env.OPTIMISM_KOVAN_API_KEY ?? ""
      }`,
      accounts:
        process.env.OPTIMISM_KOVAN_PRIVATE_KEY !== undefined
          ? [process.env.OPTIMISM_KOVAN_PRIVATE_KEY]
          : [],
    },
    // devnets
    hardhat: {
      mining: {
        auto: !(process.env.HARDHAT_DISABLE_AUTO_MINING === "true"),
        interval: [100, 3000],
      },
    },
  },
  baseURIs: {
    // mainnets
    ethereum: "https://tableland.network/chain/1/tables/",
    optimism: "https://tableland.network/chain/10/tables/",
    // testnets
    "ethereum-goerli": "https://testnetv2.tableland.network/chain/5/tables/",
    "optimism-kovan": "https://testnetv2.tableland.network/chain/69/tables/",
    // devnets
    localhost: "http://localhost:8080/chain/31337/tables/",
  },
  deployments: {
    // mainnet mainnets
    ethereum: "",
    optimism: "",
    // testnet testnets
    "ethereum-goerli": "",
    "optimism-kovan": "",
    // staging testnets
    localhost: "",
  },
};

interface RigsNetworkConfig {
  // mainnets
  ethereum: string;
  optimism: string;

  // testnets
  "ethereum-goerli": string;
  "optimism-kovan": string;

  // devnets
  localhost: string; // hardhat
}

declare module "hardhat/types/config" {
  // eslint-disable-next-line no-unused-vars
  interface HardhatUserConfig {
    baseURIs: RigsNetworkConfig;
    deployments: RigsNetworkConfig;
  }
}

declare module "hardhat/types/runtime" {
  // eslint-disable-next-line no-unused-vars
  interface HardhatRuntimeEnvironment {
    baseURI: string;
    deployment: string;
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  // Get base URI for user-selected network
  const uris = hre.userConfig.baseURIs as any;
  hre.baseURI = uris[hre.network.name];

  // Get contract address for user-selected network
  const deployments = hre.userConfig.deployments as any;
  hre.deployment = deployments[hre.network.name];
});

export default config;
