import { chain as chains } from "wagmi";
// import { deployments } from "@tableland/rigs/deployments";
import { deployments } from "../../ethereum/deployments";

export const environment =
  process.env.NODE_ENV === "development" ? "development" : "production";

export const isDevelopment = environment === "development";

export const chain = isDevelopment ? chains.polygonMumbai : chains.mainnet;

export const blockExplorerBaseUrl = isDevelopment
  ? "https://mumbai.polygonscan.com"
  : "https://etherscan.io";

export const deployment = isDevelopment
  ? deployments["polygon-mumbai"]
  : deployments.ethereum;

export const ipfsGatewayBaseUrl = isDevelopment
  ? "https://nftstorage.link"
  : "https://tableland.mypinata.cloud";
