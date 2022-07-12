import { BigNumber, utils } from "ethers";
import { ethers, network, rigsConfig } from "hardhat";
import { buildTree, hashEntry } from "../helpers/allowlist";
import { TablelandRigs } from "../typechain-types";

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

  const RigsFactory = await ethers.getContractFactory("TablelandRigs");
  const rigs = RigsFactory.attach(rigsConfig.contractAddress) as TablelandRigs;

  // const tx = await rigs.claim(
  //   BigNumber.from(allowance),
  //   BigNumber.from(allowance),
  //   proof,
  //   { value: utils.parseEther("0.05"), gasLimit: 10000000 }
  // );
  const tx = await rigs.claim(
    BigNumber.from(allowance),
    BigNumber.from(allowance),
    { value: utils.parseEther("0.05") }
  );
  await tx.wait();
  // console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
