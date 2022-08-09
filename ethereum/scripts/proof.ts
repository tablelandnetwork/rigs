import { ethers, network, rigsConfig } from "hardhat";
import { buildTree, getListFromCSVs, hashEntry } from "../helpers/allowlist";

async function main() {
  console.log(`\nGetting proof for '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Build merkle tree for allowlist
  const allowlist = await getListFromCSVs(rigsConfig.allowlistFiles);
  const allowlistTree = buildTree(allowlist);
  const waitlist = await getListFromCSVs(rigsConfig.waitlistFiles);
  const waitlistTree = buildTree(waitlist);

  // Get address
  let address = process.env.PROOF_ADDRESS;
  if (!address) {
    throw Error("no address found for proof (use env var PROOF_ADDRESS)");
  }
  address = address.toLowerCase();

  // Check allowlist
  let allowance = allowlist[address];
  if (allowance === undefined) {
    console.log("Allowlist: no allowance");
  } else {
    const proof = allowlistTree.getHexProof(hashEntry(address, allowance));
    console.log("Allowlist:", proof);
  }

  // Check waitlist
  allowance = waitlist[address];
  if (allowance === undefined) {
    console.log("Waitlist: no allowance");
  } else {
    const proof = waitlistTree.getHexProof(hashEntry(address, allowance));
    console.log("Waitlist:", proof);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
