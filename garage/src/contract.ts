import { deployments } from "@tableland/rigs/deployments";
import { TablelandRigs__factory } from "@tableland/rigs/typechain-types/factories/contracts/TablelandRigs__factory";

const deployment =
  process.env.NODE_ENV === "development"
    ? deployments["polygon-mumbai"]
    : deployments.ethereum;

export const { contractAddress } = deployment;

export const contractInterface = TablelandRigs__factory.createInterface().format(
  "json"
);
