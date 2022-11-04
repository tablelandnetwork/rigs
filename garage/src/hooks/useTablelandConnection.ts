import { connect, ChainName, SUPPORTED_CHAINS } from "@tableland/sdk";
import { chain as envChain } from "../env";

const chain = Object.entries(SUPPORTED_CHAINS).find(
  ([_, chain]) => chain.chainId === envChain.id
)![0] as ChainName;

export const connection = connect({
  network: "testnet",
  chain,
});

const data = { connection };

export const useTablelandConnection = () => {
  return data;
};
