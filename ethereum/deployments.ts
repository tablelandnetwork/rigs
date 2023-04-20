import { helpers } from "@tableland/sdk";

export interface RigsDeployment {
  // Contracts
  contractAddress: string;
  royaltyContractAddress: string;
  pilotsAddress: string;

  // Tables network
  tablelandChain: helpers.ChainName;
  tablelandHost:
    | "https://tableland.network"
    | "https://testnets.tableland.network"
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
  ftRewardsTable: string;
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
    pilotsAddress: "0xFe688e894AAA2A8F4740d09DA8c434Eb0B1AFb5D",
    tablelandChain: "arbitrum",
    tablelandHost: "https://tableland.network",
    contractTable: "rigs_contract_42161_12",
    allowlistTable: "rigs_allowlist_42161_14",
    partsTable: "parts_42161_7",
    layersTable: "layers_42161_8",
    attributesTable: "rig_attributes_42161_15",
    lookupsTable: "lookups_42161_10",
    pilotSessionsTable: "pilot_sessions_1_7",
    ftRewardsTable: "", // TODO fill in with real value from deployment
    displayAttributes: true,
  },
  // testnets
  "polygon-mumbai": {
    contractAddress: "0x36Ae6D7e2B460530A22416C8fC8A506cADE353B8",
    royaltyContractAddress: "0xb61974afD4348DA16e45BC48d53883A281bc4A6e",
    pilotsAddress: "0x171c03D706f02Ed57f8509539ED590A69d286D61",
    tablelandChain: "maticmum",
    tablelandHost: "https://testnets.tableland.network",
    contractTable: "rigs_contract_80001_3819",
    allowlistTable: "rigs_allowlist_80001_3820",
    partsTable: "parts_80001_4038",
    layersTable: "layers_80001_4039",
    attributesTable: "rig_attributes_80001_4040",
    lookupsTable: "lookups_80001_4041",
    pilotSessionsTable: "pilot_sessions_80001_4078",
    ftRewardsTable: "", // TODO fill in with real value from deployment
    displayAttributes: true,
  },
  localhost: {
    contractAddress: "",
    royaltyContractAddress: "",
    pilotsAddress: "",
    tablelandChain: "local-tableland",
    tablelandHost: "http://localhost:8080",
    contractTable: "",
    allowlistTable: "",
    partsTable: "",
    layersTable: "",
    attributesTable: "",
    lookupsTable: "",
    pilotSessionsTable: "",
    ftRewardsTable: "",
    displayAttributes: true,
  },
};
