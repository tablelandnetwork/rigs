import { deployment } from "./env";
import { TablelandRigs__factory } from "@tableland/rigs/typechain-types/factories/contracts/TablelandRigs__factory";

export const { contractAddress } = deployment;

export const contractInterface = TablelandRigs__factory.createInterface().format(
  "json"
);
