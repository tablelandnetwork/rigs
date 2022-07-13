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
    contractAddress: "0x7853d6c447A11E1a433a2B59bf450631001BF855",
    royaltyContractAddress: "0xcB5588d33c8E82E7cFcfaB9dBfA1a6e88B55192e",
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
