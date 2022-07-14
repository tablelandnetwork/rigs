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
    contractAddress: "0x0E1B53feac55716c5fdb2623ED719144A423cEEE",
    royaltyContractAddress: "0xA51Ce9F6604925c16e88a6A0a017BB49573DC3cB",
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
