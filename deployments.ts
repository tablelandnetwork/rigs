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
    contractTable: "rigs_contract_5_57",
    allowlistTable: "rigs_allowlist_5_59",
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
    contractAddress: "",
    royaltyContractAddress: "",
    contractTable: "rigs_contract_5_57",
    allowlistTable: "rigs_allowlist_5_59",
  },
  localhost: {
    contractAddress: "",
    royaltyContractAddress: "",
    contractTable: "",
    allowlistTable: "",
  },
};
