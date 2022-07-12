import * as dotenv from "dotenv";

import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-dependency-compiler";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import { AllowList } from "./helpers/allowlist";
import { ChainName } from "@tableland/sdk";

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
      "@tableland/evm/contracts/TablelandTables.sol",
      "@openzeppelin/contracts/finance/PaymentSplitter.sol",
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
      optimisticKovan: process.env.OPTIMISM_ETHERSCAN_API_KEY || "",

      // polygon
      polygon: process.env.POLYSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYSCAN_API_KEY || "",
    },
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
    "ethereum-rinkeby": {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${
        process.env.ETHEREUM_RINKEBY_API_KEY ?? ""
      }`,
      accounts:
        process.env.ETHEREUM_RINKEBY_PRIVATE_KEY !== undefined
          ? [process.env.ETHEREUM_RINKEBY_PRIVATE_KEY]
          : [],
    },
    "ethereum-goerli": {
      url: `https://eth-goerli.g.alchemy.com/v2/${
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
      feeRecipient: "0x4D13f1C893b4CaFAF791501EDACA331468FEfeDe",
      maxSupply: 3000,
      etherPrice: "0.05",
      tables: {
        tablelandChain: "ethereum-goerli",
        tablelandPrivateKey: process.env.ETHEREUM_GOERLI_PRIVATE_KEY,
        tablelandProvider: process.env.ETHEREUM_GOERLI_API_KEY,
        tablelandHost: "https://testnet.tableland.network",
        tokensTable: "rigs_5_22",
        attributesTable: "rig_attributes_5_20",
      },
      royaltyReceivers: [
        "0xE2ECC1552111f9E78342F79b5f5e87877CF57b8F",
        "0xF4A070a7Fe619cb1996De0cEaE45b806Eb5ceC65",
      ],
      royaltyReceiverShares: [20, 80],
      allowlist: {
        "0x4D13f1C893b4CaFAF791501EDACA331468FEfeDe": {
          freeAllowance: 1,
          paidAllowance: 2,
        },
        "0xE2ECC1552111f9E78342F79b5f5e87877CF57b8F": {
          freeAllowance: 2,
          paidAllowance: 3,
        },
        "0xF4A070a7Fe619cb1996De0cEaE45b806Eb5ceC65": {
          freeAllowance: 0,
          paidAllowance: 4,
        },
        "0x06A948303AA30b6870896C84E83Ba00Df5292950": {
          freeAllowance: 1,
          paidAllowance: 5,
        },
        "0x1f48aa5069bcdae06A0d009b42E20ccc33D1Ff51": {
          freeAllowance: 1,
          paidAllowance: 0,
        },
      },
      waitlist: {
        "0x4D13f1C893b4CaFAF791501EDACA331468FEfeDe": {
          freeAllowance: 1,
          paidAllowance: 2,
        },
      },
    },
    // mainnets
    ethereum: {
      contractAddress: "",
      royaltyContractAddress: "",
      contractTable: "",
      allowlistTable: "",
    },
    // testnets
    "ethereum-rinkeby": {
      contractAddress: "",
      royaltyContractAddress: "",
      contractTable: "",
      allowlistTable: "",
    },
    "ethereum-goerli": {
      contractAddress: "",
      royaltyContractAddress: "",
      contractTable: "",
      allowlistTable: "",
    },
    "optimism-kovan": {
      contractAddress: "",
      royaltyContractAddress: "",
      contractTable: "",
      allowlistTable: "",
    },
    "polygon-mumbai": {
      contractAddress: "0x3dcadCB82489bBF45a6bCBa5dae0373B7644114b",
      royaltyContractAddress: "0xAd8Dd3fbeE6823cD0AA1A4a531D43F3dC3602e04",
      contractTable: "rigs_contract_5_44",
      allowlistTable: "rigs_allowlist_5_45",
    },
    localhost: {
      contractAddress: "",
      royaltyContractAddress: "",
      contractTable: "",
      allowlistTable: "",
    },
  },
};

interface RigsTables {
  tablelandChain: ChainName;
  tablelandPrivateKey: string | undefined;
  tablelandProvider: string | undefined;
  tablelandHost:
    | "https://testnet.tableland.network"
    | "https://staging.tableland.network";
  tokensTable: string;
  attributesTable: string;
}

interface RigsConfig {
  // rigs info
  name: string;
  description: string;
  image: string;
  externalLink: string;
  sellerFeeBasisPoints: number;
  feeRecipient: string;

  // rigs tables
  tables: RigsTables;

  // rigs args
  maxSupply: number;
  etherPrice: string;

  // royalty splitter args
  royaltyReceivers: string[];
  royaltyReceiverShares: number[];

  // whitelists
  allowlist: AllowList;
  waitlist: AllowList;
}

interface RigsDeployment {
  contractAddress: string;
  royaltyContractAddress: string;
  contractTable: string;
  allowlistTable: string;
}

interface RigsNetworkConfig {
  args: RigsConfig;

  // mainnets
  ethereum: RigsDeployment;

  // testnets
  "ethereum-rinkeby": RigsDeployment;
  "ethereum-goerli": RigsDeployment;
  "optimism-kovan": RigsDeployment;
  "polygon-mumbai": RigsDeployment;

  localhost: RigsDeployment; // hardhat
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
  hre.rigsDeployment = (config as any)[hre.network.name];
});

export default config;
