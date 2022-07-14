import { ethers, network, rigsConfig } from "hardhat";
import { buildTree, getListFromCSVs, hashEntry } from "../helpers/allowlist";

async function main() {
  console.log(`\nClaiming on '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Build merkle tree for allowlist
  const allowlist = await getListFromCSVs(rigsConfig.allowlistFiles);
  const merkletree = buildTree(allowlist);

  // Get proof
  const address = account.address;
  const allowance = allowlist[address];
  if (allowance === undefined) {
    throw Error("no allowance");
  }
  const proof = merkletree.getHexProof(hashEntry(address, allowlist[address]));
  console.log("Proof:", proof);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
