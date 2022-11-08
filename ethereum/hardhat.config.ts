import * as dotenv from "dotenv";

import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-dependency-compiler";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import { deployments, RigsDeployment, RigsDeployments } from "./deployments";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.15",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  dependencyCompiler: {
    paths: [
      "@openzeppelin/contracts/finance/PaymentSplitter.sol",
      // For testing purposes
      "@tableland/evm/contracts/TablelandTables.sol",
      "@tableland/evm/contracts/test/TestAllowAllTablelandController.sol",
      "@tableland/evm/contracts/test/TestERC721Enumerable.sol",
      "@tableland/evm/contracts/test/TestSQLHelpers.sol",
    ],
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
    apiKey: {
      // ethereum
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",

      // optimism
      optimisticEthereum: process.env.OPTIMISM_ETHERSCAN_API_KEY || "",
      optimisticGoerli: process.env.OPTIMISM_ETHERSCAN_API_KEY || "",

      // polygon
      polygon: process.env.POLYSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYSCAN_API_KEY || "",

      // arbitrum
      arbitrum: process.env.REPLACE_ME || "",
      arbitrumGoerli: process.env.REPLACE_ME || "",
    },
  },
  networks: {
    // mainnets
    ethereum: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${
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
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${
        process.env.POLYGON_API_KEY ?? ""
      }`,
      accounts:
        process.env.POLYGON_PRIVATE_KEY !== undefined
          ? [process.env.POLYGON_PRIVATE_KEY]
          : [],
    },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${
        process.env.ARBITRUM_API_KEY ?? ""
      }`,
      accounts:
        process.env.ARBITRUM_PRIVATE_KEY !== undefined
          ? [process.env.ARBITRUM_PRIVATE_KEY]
          : [],
    },
    // testnets
    "ethereum-goerli": {
      url: `https://eth-goerli.g.alchemy.com/v2/${
        process.env.ETHEREUM_GOERLI_API_KEY ?? ""
      }`,
      accounts:
        process.env.ETHEREUM_GOERLI_PRIVATE_KEY !== undefined
          ? [process.env.ETHEREUM_GOERLI_PRIVATE_KEY]
          : [],
    },
    "optimism-goerli": {
      url: `https://opt-goerli.g.alchemy.com/v2/${
        process.env.OPTIMISM_GOERLI_API_KEY ?? ""
      }`,
      accounts:
        process.env.OPTIMISM_GOERLI_PRIVATE_KEY !== undefined
          ? [process.env.OPTIMISM_GOERLI_PRIVATE_KEY]
          : [],
    },
    "polygon-mumbai": {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${
        process.env.POLYGON_MUMBAI_API_KEY ?? ""
      }`,
      accounts:
        process.env.POLYGON_MUMBAI_PRIVATE_KEY !== undefined
          ? [process.env.POLYGON_MUMBAI_PRIVATE_KEY]
          : [],
    },
    "arbitrum-goerli": {
      url: `https://arb-goerli.g.alchemy.com/v2/${
        process.env.ARBITRUM_GOERLI_API_KEY ?? ""
      }`,
      accounts:
        process.env.ARBITRUM_GOERLI_PRIVATE_KEY !== undefined
          ? [process.env.ARBITRUM_GOERLI_PRIVATE_KEY]
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
  config: {
    args: {
      name: "Tableland Rigs",
      description:
        "A 3k generative NFT built from 1,074 handcrafted works of art for the builders and creatives of cyberspace.",
      image:
        "https://bafybeidmvuy43bsfla4ewabfegdf6k3vqmjlapn7ojsv5fczpym3lpazzu.ipfs.dweb.link/rigs.png",
      externalLink: "https://tableland.xyz/rigs",
      sellerFeeBasisPoints: 500,
      feeRecipient: "0xEC19654b1c1DfAc2427F06D0fcA991f43C6b1281",
      maxSupply: 50,
      etherPrice: "0.05",
      mintPhase: "public",
      tables: {
        tablelandPrivateKey: process.env.POLYGON_MUMBAI_PRIVATE_KEY,
        tablelandProvider: process.env.POLYGON_MUMBAI_API_KEY,
      },
      royaltyReceivers: [
        "0x12fC004d3bA84dF22ebfdE93A7a0B87267b06ACb",
        "0xEC19654b1c1DfAc2427F06D0fcA991f43C6b1281",
      ],
      royaltyReceiverShares: [2, 3],
      allowlistFiles: ["../allowlists/main_allowlist.csv"],
      waitlistFiles: ["../allowlists/main_waitlist.csv"],
      waitlistSize: 100,
    },
    deployments,
  },
};

interface RigsTablesConfig {
  tablelandPrivateKey: string | undefined;
  tablelandProvider: string | undefined;
}

interface RigsConfig {
  // rigs info
  name: string;
  description: string;
  image: string;
  externalLink: string;
  sellerFeeBasisPoints: number;
  feeRecipient: string;

  // mint phase
  mintPhase: "closed" | "allowlist" | "waitlist" | "public";

  // rigs tables
  tables: RigsTablesConfig;

  // rigs args
  maxSupply: number;
  etherPrice: string;

  // royalty splitter args
  royaltyReceivers: string[];
  royaltyReceiverShares: number[];

  // whitelists
  allowlistFiles: string[];
  waitlistFiles: string[];
  waitlistSize: number;
}

interface RigsNetworkConfig {
  args: RigsConfig;

  deployments: RigsDeployments;
}

declare module "hardhat/types/config" {
  // eslint-disable-next-line no-unused-vars
  interface HardhatUserConfig {
    config: RigsNetworkConfig;
  }
}

declare module "hardhat/types/runtime" {
  // eslint-disable-next-line no-unused-vars
  interface HardhatRuntimeEnvironment {
    rigsConfig: RigsConfig;
    rigsDeployment: RigsDeployment;
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  // Get configs for user-selected network
  const config = hre.userConfig.config;
  hre.rigsConfig = config.args;
  hre.rigsDeployment = (config.deployments as any)[hre.network.name];
});

export default config;
