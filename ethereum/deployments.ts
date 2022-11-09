import { ChainName } from "@tableland/sdk";

export interface RigsDeployment {
  // Contracts
  contractAddress: string;
  royaltyContractAddress: string;

  // Tables network
  tablelandChain: ChainName;
  tablelandHost:
    | "https://testnet.tableland.network"
    | "https://staging.tableland.network"
    | "http://localhost:8080";

  // Table names
  contractTable: string;
  allowlistTable: string;
  partsTable: string;
  layersTable: string;
  attributesTable: string;
  lookupsTable: string;
  pilotSessionsTable: string;
  displayAttributes: boolean;
}

export interface RigsDeployments {
  [key: string]: RigsDeployment;
}

export const deployments: RigsDeployments = {
  // mainnets
  ethereum: {
    contractAddress: "0x8EAa9AE1Ac89B1c8C8a8104D08C045f78Aadb42D",
    royaltyContractAddress: "0x9BE9627e25c9f348C1edB6E46dBCa2a6669e2D56",
    tablelandChain: "ethereum-goerli",
    tablelandHost: "https://testnet.tableland.network",
    contractTable: "rigs_contract_5_57",
    allowlistTable: "rigs_allowlist_5_59",
    partsTable: "parts_5_30",
    layersTable: "layers_5_29",
    attributesTable: "rig_attributes_5_27",
    lookupsTable: "", // TODO: Fill me.
    pilotSessionsTable: "", // TODO: Fill me.
    displayAttributes: true,
  },
  // testnets
  "polygon-mumbai": {
    contractAddress: "0xc90CE622EEAbA7B6DA1066B6E9dF0997EeC88a7d",
    royaltyContractAddress: "0xB6349B77E802331dd5bFdef9241538e24ed51C31",
    tablelandChain: "polygon-mumbai",
    tablelandHost: "https://testnet.tableland.network",
    contractTable: "rigs_contract_80001_3513",
    allowlistTable: "rigs_allowlist_80001_3514",
    partsTable: "parts_42161_2",
    layersTable: "layers_42161_3",
    attributesTable: "rig_attributes_42161_4",
    lookupsTable: "lookups_42161_5",
    pilotSessionsTable: "pilot_sessions_80001_3598",
    displayAttributes: true,
  },
  localhost: {
    contractAddress: "",
    royaltyContractAddress: "",
    tablelandChain: "ethereum-goerli",
    tablelandHost: "http://localhost:8080",
    contractTable: "",
    allowlistTable: "",
    partsTable: "",
    layersTable: "",
    attributesTable: "",
    lookupsTable: "",
    pilotSessionsTable: "",
    displayAttributes: true,
  },
};
