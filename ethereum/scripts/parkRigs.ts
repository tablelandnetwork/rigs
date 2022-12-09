import { ethers, network, rigsDeployment } from "hardhat";
import { TablelandRigs } from "../typechain-types";

async function main() {
  console.log(`\nParking rigs on '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get contract address
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsDeployment.contractAddress}'`);

  // Update mint phase
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const tx = await rigs.parkRigAsOwner([
    /* rigs IDs to park here */
  ]);
  const receipt = await tx.wait();
  console.log(`parked rigs with txn '${receipt.transactionHash}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
