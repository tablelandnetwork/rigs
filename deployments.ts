export interface RigsDeployment {
  contractAddress: string;
  royaltyContractAddress: string;
  contractTable: string;
  allowlistTable: string;
}

export interface RigsDeployments {
  [key: string]: RigsDeployment;
}

export const deployments: RigsDeployments = {
  // mainnets
  ethereum: {
    contractAddress: "",
    royaltyContractAddress: "",
    contractTable: "",
    allowlistTable: "",
  },
  // testnets
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
    contractAddress: "0xE65b7b6417533Df4d84751BD1AE76fF652D40460",
    royaltyContractAddress: "0x0dd5C9D495d2D0723F05EF829ae74716ed39C774",
    contractTable: "rigs_contract_5_46",
    allowlistTable: "rigs_allowlist_5_47",
  },
  localhost: {
    contractAddress: "",
    royaltyContractAddress: "",
    contractTable: "",
    allowlistTable: "",
  },
};
