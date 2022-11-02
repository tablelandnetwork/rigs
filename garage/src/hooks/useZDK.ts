import { ZDK, ZDKNetwork, ZDKChain } from "@zoralabs/zdk";

const networkInfo = {
  network: ZDKNetwork.Ethereum,
  chain: ZDKChain.Mainnet,
};

const API_ENDPOINT = "https://api.zora.co/graphql";
const args = {
  endPoint: API_ENDPOINT,
  networks: [networkInfo],
  // apiKey: process.env.API_KEY,
};

const zdk = new ZDK(args);

export const useZDK = () => {
  return { zdk };
};

