import { connect } from "@tableland/sdk";

const connection = connect({ network: "testnet" });
const data = { connection };

export const useTablelandConnection = () => {
  return data;
};
