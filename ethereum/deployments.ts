import { helpers } from "@tableland/sdk";

export interface RigsDeployment {
  // Contracts
  contractAddress: string;
  royaltyContractAddress: string;
  pilotsAddress: string;
  votingContractAddress: string;
  missionContractAddress: string;

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
  rigsTable: string;
  attributesTable: string;
  dealsTable: string;
  lookupsTable: string;
  pilotSessionsTable: string;
  ftRewardsTable: string;

  // Voting table names
  proposalsTable: string;
  ftSnapshotTable: string;
  votesTable: string;
  optionsTable: string;

  // Mission table names
  missionsTable: string;
  missionContributionsTable: string;

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
    votingContractAddress: "0xE9Fb4f78f23457F69f516c6806E5C9e8756C8c57",
    missionContractAddress: "", // TODO fill in
    tablelandChain: "arbitrum",
    tablelandHost: "https://tableland.network",
    contractTable: "rigs_contract_42161_12",
    allowlistTable: "rigs_allowlist_42161_14",
    partsTable: "parts_42161_7",
    layersTable: "layers_42161_8",
    rigsTable: "rigs_314_3",
    attributesTable: "rig_attributes_42161_15",
    dealsTable: "deals_314_4",
    lookupsTable: "lookups_314_5",
    pilotSessionsTable: "pilot_sessions_1_7",
    ftRewardsTable: "ft_rewards_42161_18",
    proposalsTable: "proposals_42161_19",
    ftSnapshotTable: "ft_snapshot_42161_20",
    votesTable: "votes_42161_21",
    optionsTable: "options_42161_22",
    missionsTable: "", // TODO fill in
    missionContributionsTable: "", // TODO fill in
    displayAttributes: true,
  },
  // testnets
  "polygon-mumbai": {
    contractAddress: "0xCA019FF8C4257Fc02F94C8B0E34B3787DA850A78",
    royaltyContractAddress: "0xd8E1803C479DFFf004B46F1560c575Acc5bf25A0",
    pilotsAddress: "0x1Ae76F54c561f32c24c74A562353D085C010a2E8",
    votingContractAddress: "0x3d06EB64C20dD24D613b200325D1E55517E41591",
    missionContractAddress: "0xB169B0bED3e4cA014dC329318935E0Dcf50e14b6",
    tablelandChain: "maticmum",
    tablelandHost: "https://testnets.tableland.network",
    contractTable: "rigs_contract_80001_7136",
    allowlistTable: "rigs_allowlist_80001_7135",
    partsTable: "parts_80001_4038",
    layersTable: "layers_80001_4039",
    rigsTable: "rigs_314159_9",
    attributesTable: "rig_attributes_80001_4040",
    dealsTable: "deals_314159_8",
    lookupsTable: "lookups_314159_10",
    pilotSessionsTable: "pilot_sessions_80001_7137",
    ftRewardsTable: "ft_rewards_80001_7138",
    proposalsTable: "proposals_80001_7139",
    ftSnapshotTable: "ft_snapshot_80001_7140",
    votesTable: "votes_80001_7141",
    optionsTable: "options_80001_7142",
    missionsTable: "missions_80001_7223",
    missionContributionsTable: "mission_contributions_80001_7224",
    displayAttributes: true,
  },
  localhost: {
    contractAddress: "",
    royaltyContractAddress: "",
    pilotsAddress: "",
    votingContractAddress: "",
    missionContractAddress: "",
    tablelandChain: "local-tableland",
    tablelandHost: "http://localhost:8080",
    contractTable: "",
    allowlistTable: "",
    partsTable: "",
    layersTable: "",
    rigsTable: "",
    attributesTable: "",
    dealsTable: "",
    lookupsTable: "",
    pilotSessionsTable: "",
    ftRewardsTable: "",
    proposalsTable: "",
    ftSnapshotTable: "",
    votesTable: "",
    optionsTable: "",
    missionsTable: "",
    missionContributionsTable: "",
    displayAttributes: true,
  },
};
