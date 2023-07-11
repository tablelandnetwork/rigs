import * as dotenv from "dotenv";

import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-dependency-compiler";
import "hardhat-contract-sizer";
import { deployments, RigsDeployment, RigsDeployments } from "./deployments";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
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

      // polygon
      polygonMumbai: process.env.POLYSCAN_API_KEY || "",
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
    "polygon-mumbai": {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${
        process.env.POLYGON_MUMBAI_API_KEY ?? ""
      }`,
      accounts:
        process.env.POLYGON_MUMBAI_PRIVATE_KEY !== undefined
          ? [process.env.POLYGON_MUMBAI_PRIVATE_KEY]
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
      admin: "0x472028E35b69d92caaF804fA32c9D7AcD673AA37",
      maxSupply: 3000,
      etherPrice: "0.05",
      mintPhase: "public",
      tables: {
        localhost: {
          tablelandPrivateKey: process.env.LOCAL_TABLELAND_PRIVATE_KEY,
        },
        testnet: {
          tablelandPrivateKey: process.env.POLYGON_MUMBAI_PRIVATE_KEY,
          tablelandAlchemyKey: process.env.POLYGON_MUMBAI_API_KEY,
        },
        mainnet: {
          tablelandPrivateKey: process.env.ARBITRUM_PRIVATE_KEY,
          tablelandAlchemyKey: process.env.ARBITRUM_API_KEY,
        },
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
  tablelandAlchemyKey?: string;
}

interface RigsConfig {
  // rigs info
  name: string;
  description: string;
  image: string;
  externalLink: string;
  sellerFeeBasisPoints: number;
  feeRecipient: string;
  admin: string;

  // mint phase
  mintPhase: "closed" | "allowlist" | "waitlist" | "public";

  // rigs tables
  tables: {
    localhost: RigsTablesConfig;
    testnet: RigsTablesConfig;
    mainnet: RigsTablesConfig;
  };

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
    mainnet: boolean;
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  // Get configs for user-selected network
  const config = hre.userConfig.config;
  hre.rigsConfig = config.args;
  hre.rigsDeployment = (config.deployments as any)[hre.network.name];
  hre.mainnet = hre.network.name === "ethereum";
});

export default config;
