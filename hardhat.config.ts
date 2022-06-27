import * as dotenv from "dotenv";

import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-dependency-compiler";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";

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
    paths: ["@openzeppelin/contracts/finance/PaymentSplitter.sol"],
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
    // apiKey: {
    //   "optimism-kovan-staging": process.env.ETHERSCAN_API_KEY || "",
    // },
    // customChains: [
    //   {
    //     network: "optimism-kovan-staging",
    //     chainId: 69,
    //     urls: {
    //       apiURL: "https://api-kovan-optimistic.etherscan.io/api",
    //       browserURL: "https://kovan-optimistic.etherscan.io",
    //     },
    //   },
    // ],
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
    "ethereum-rinkeby-staging": {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${
        process.env.ETHEREUM_RINKEBY_STAGING_API_KEY ?? ""
      }`,
      accounts:
        process.env.ETHEREUM_RINKEBY_STAGING_PRIVATE_KEY !== undefined
          ? [process.env.ETHEREUM_RINKEBY_STAGING_PRIVATE_KEY]
          : [],
    },
    "optimism-kovan-staging": {
      url: `https://opt-kovan.g.alchemy.com/v2/${
        process.env.OPTIMISM_KOVAN_STAGING_API_KEY ?? ""
      }`,
      accounts:
        process.env.OPTIMISM_KOVAN_STAGING_PRIVATE_KEY !== undefined
          ? [process.env.OPTIMISM_KOVAN_STAGING_PRIVATE_KEY]
          : [],
    },
    hardhat: {
      mining: {
        auto: !(process.env.HARDHAT_DISABLE_AUTO_MINING === "true"),
        interval: [100, 3000],
      },
    },
  },
  config: {
    // mainnets
    ethereum: {
      maxSupply: 0,
      etherPrice: "",
      beneficiary: "",
      uriTemplate: "",
      royaltyReceivers: [],
      royaltyReceiverShares: [],
      contractAddress: "",
      royaltyContractAddress: "",
      autoMint: 0,
    },
    optimism: {
      maxSupply: 0,
      etherPrice: "",
      beneficiary: "",
      uriTemplate: "",
      royaltyReceivers: [],
      royaltyReceiverShares: [],
      contractAddress: "",
      royaltyContractAddress: "",
      autoMint: 0,
    },
    // testnets
    "ethereum-rinkeby": {
      maxSupply: 0,
      etherPrice: "",
      beneficiary: "",
      uriTemplate: "",
      royaltyReceivers: [],
      royaltyReceiverShares: [],
      contractAddress: "",
      royaltyContractAddress: "",
      autoMint: 0,
    },
    "ethereum-goerli": {
      maxSupply: 0,
      etherPrice: "",
      beneficiary: "",
      uriTemplate: "",
      royaltyReceivers: [],
      royaltyReceiverShares: [],
      contractAddress: "",
      royaltyContractAddress: "",
      autoMint: 0,
    },
    "optimism-kovan": {
      maxSupply: 0,
      etherPrice: "",
      beneficiary: "",
      uriTemplate: "",
      royaltyReceivers: [],
      royaltyReceiverShares: [],
      contractAddress: "",
      royaltyContractAddress: "",
      autoMint: 0,
    },
    // devnets
    "ethereum-rinkeby-staging": {
      maxSupply: 1000,
      etherPrice: "0.05",
      beneficiary: "0x4D13f1C893b4CaFAF791501EDACA331468FEfeDe",
      uriTemplate:
        "https://staging.tableland.network/query?s=select%20json_build_object(%27name%27%2C%20concat(%27%23%27%2C%20id)%2C%20%27external_url%27%2C%20concat(%27https%3A%2F%2Ftableland.xyz%2Frigs%2F%27%2C%20id)%2C%20%27image%27%2C%20image%2C%20%27image_alpha%27%2C%20image_alpha%2C%20%27thumb%27%2C%20thumb%2C%20%27thumb_alpha%27%2C%20thumb_alpha%2C%20%27attributes%27%2C%20%20json_agg(json_build_object(%27display_type%27%2C%20display_type%2C%20%27trait_type%27%2C%20trait_type%2C%20%27value%27%2C%20value)))%20from%20test_rigs_69_5%20join%20test_rig_attributes_69_6%20on%20test_rigs_69_5.id%20%3D%20test_rig_attributes_69_6.rig_id%20where%20id%20%3D%20{id}%20group%20by%20id%3B&mode=list",
      royaltyReceivers: [
        "0xE2ECC1552111f9E78342F79b5f5e87877CF57b8F",
        "0xF4A070a7Fe619cb1996De0cEaE45b806Eb5ceC65",
      ],
      royaltyReceiverShares: [20, 80],
      contractAddress: "0x879A53A8Ac46fc87Cfe6F7700f0624F50a750713",
      royaltyContractAddress: "0x3f508A8a4c2Db38F5411C9A8CC169cac2AA2822a",
      autoMint: 10,
    },
    "optimism-kovan-staging": {
      maxSupply: 1000,
      etherPrice: "0.05",
      beneficiary: "0x4D13f1C893b4CaFAF791501EDACA331468FEfeDe",
      uriTemplate:
        "https://staging.tableland.network/query?s=select%20json_build_object(%27name%27%2C%20concat(%27%23%27%2C%20id)%2C%20%27external_url%27%2C%20concat(%27https%3A%2F%2Ftableland.xyz%2Frigs%2F%27%2C%20id)%2C%20%27image%27%2C%20image%2C%20%27image_alpha%27%2C%20image_alpha%2C%20%27thumb%27%2C%20thumb%2C%20%27thumb_alpha%27%2C%20thumb_alpha%2C%20%27attributes%27%2C%20%20json_agg(json_build_object(%27display_type%27%2C%20display_type%2C%20%27trait_type%27%2C%20trait_type%2C%20%27value%27%2C%20value)))%20from%20test_rigs_69_5%20join%20test_rig_attributes_69_6%20on%20test_rigs_69_5.id%20%3D%20test_rig_attributes_69_6.rig_id%20where%20id%20%3D%20{id}%20group%20by%20id%3B&mode=list",
      royaltyReceivers: [
        "0xE2ECC1552111f9E78342F79b5f5e87877CF57b8F",
        "0xF4A070a7Fe619cb1996De0cEaE45b806Eb5ceC65",
      ],
      royaltyReceiverShares: [20, 80],
      contractAddress: "0xA0C05329DD1100770076631472d0328381d590dB",
      royaltyContractAddress: "0x9D54f454F040fC993924aea7aA6ADec282E280F0",
      autoMint: 10,
    },
    localhost: {
      maxSupply: 0,
      etherPrice: "",
      beneficiary: "",
      uriTemplate: "",
      royaltyReceivers: [],
      royaltyReceiverShares: [],
      contractAddress: "",
      royaltyContractAddress: "",
      autoMint: 0,
    },
  },
};

interface RigsConfig {
  // rigs args
  maxSupply: number;
  etherPrice: string;
  beneficiary: string;
  uriTemplate: string;

  // royalty splitter args
  royaltyReceivers: string[];
  royaltyReceiverShares: number[];

  // deployments
  contractAddress: string;
  royaltyContractAddress: string;

  // development helpers
  autoMint: number;
}

interface RigsNetworkConfig {
  // mainnets
  ethereum: RigsConfig;
  optimism: RigsConfig;

  // testnets
  "ethereum-rinkeby": RigsConfig;
  "ethereum-goerli": RigsConfig;
  "optimism-kovan": RigsConfig;

  // devnets
  "ethereum-rinkeby-staging": RigsConfig;
  "optimism-kovan-staging": RigsConfig;
  localhost: RigsConfig; // hardhat
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
  }
}

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  // Get base URI for user-selected network
  const config = hre.userConfig.config as any;
  hre.rigsConfig = config[hre.network.name];
});

export default config;
