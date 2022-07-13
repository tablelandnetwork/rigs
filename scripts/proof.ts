import { ethers, network, rigsConfig } from "hardhat";
import { buildTree, hashEntry } from "../helpers/allowlist";

async function main() {
  console.log(`\nClaiming on '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Build merkle tree for allowlist
  const merkletree = buildTree(rigsConfig.allowlist);

  // Get proof
  const allowance = rigsConfig.allowlist[account.address];
  if (allowance === undefined) {
    throw Error("no allowance");
  }
  const proof = merkletree.getHexProof(
    hashEntry(account.address, rigsConfig.allowlist[account.address])
  );
  console.log("Proof:", proof);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
