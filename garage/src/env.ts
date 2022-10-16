import { chain as chains } from "wagmi";
import { deployments, RigsDeployment } from "@tableland/rigs/deployments";

export const environment =
  process.env.NODE_ENV === "development" ? "development" : "production";

export const isDevelopment = environment === "development";

export const chain = isDevelopment ? chains.polygonMumbai : chains.mainnet;

export const blockExplorerBaseUrl = isDevelopment
  ? "https://mumbai.polygonscan.com"
  : "https://etherscan.io";

// TODO(daniel): once the data in @tableland/rigs is up to date just reference
// deployments["polygon-mumbai"] and deployments.ethereum
export const deployment: Pick<
  RigsDeployment,
  "attributesTable" | "lookupsTable" | "pilotSessionsTable" | "contractAddress"
> = isDevelopment
  ? {
      attributesTable: "rig_attributes_80001_3507",
      lookupsTable: "lookups_80001_3508",
      pilotSessionsTable: "pilot_sessions_80001_3515",
      contractAddress: "0x2f9EE58e25D1AcA55841D98f7f1b0aEbD11750Bc",
    }
  : deployments.ethereum;

export const ipfsGatewayBaseUrl = isDevelopment
  ? "https://nftstorage.link"
  : "https://tableland.mypinata.cloud";
