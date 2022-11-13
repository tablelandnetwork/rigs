import { ChainName } from "@tableland/sdk";

export interface RigsDeployment {
  // Contracts
  contractAddress: string;
  royaltyContractAddress: string;
  pilotsAddress: string;

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
    pilotsAddress: "", // TODO: Fill me.
    tablelandChain: "ethereum-goerli",
    tablelandHost: "https://testnet.tableland.network",
    contractTable: "rigs_contract_5_57",
    allowlistTable: "rigs_allowlist_5_59",
    partsTable: "parts_42161_7",
    layersTable: "layers_42161_8",
    attributesTable: "rig_attributes_42161_9",
    lookupsTable: "lookups_42161_10",
    pilotSessionsTable: "", // TODO: Fill me.
    displayAttributes: true,
  },
  // testnets
  "polygon-mumbai": {
    contractAddress: "0xa04ac9Ca2FE3Db8f372B1364CdaD6fc58453Fde8",
    royaltyContractAddress: "0xa3c2D5633E31b5b5f7a97664d5Aeb06413931721",
    pilotsAddress: "0xEAbC6eF167a61bA20bb77030bd2cf7eAa218f11D",
    tablelandChain: "polygon-mumbai",
    tablelandHost: "https://testnet.tableland.network",
    contractTable: "rigs_contract_80001_3819",
    allowlistTable: "rigs_allowlist_80001_3820",
    partsTable: "",
    layersTable: "",
    attributesTable: "rig_attributes_80001_3507",
    lookupsTable: "lookups_80001_3508",
    pilotSessionsTable: "",
    displayAttributes: true,
  },
  localhost: {
    contractAddress: "",
    royaltyContractAddress: "",
    pilotsAddress: "",
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
