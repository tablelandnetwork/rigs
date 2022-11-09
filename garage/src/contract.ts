import { deployment } from "./env";
import { TablelandRigs__factory } from "@tableland/rigs";

export const { contractAddress } = deployment;

export const contractInterface = TablelandRigs__factory.createInterface().format(
  "json"
);
