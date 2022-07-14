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
    contractAddress: "0x8EAa9AE1Ac89B1c8C8a8104D08C045f78Aadb42D",
    royaltyContractAddress: "0xC36E6696eEAFe95df20748978A4e71103ecAf8BD",
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
    contractAddress: "0x875fc1205Cb81A1F38fC4deEC44390c2aC5f5890",
    royaltyContractAddress: "0x13287B498F61c735221e11eD2ED6808597d996f3",
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
