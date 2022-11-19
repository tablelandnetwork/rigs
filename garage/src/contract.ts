import { deployment } from "./env";
import abi from "./contract.json";

export const { contractAddress } = deployment;

export const contractInterface = abi;
