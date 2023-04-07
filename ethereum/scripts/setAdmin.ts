import { ethers, network, rigsConfig, rigsDeployment } from "hardhat";
import { TablelandRigs } from "../typechain-types";

async function main() {
  console.log(`\nSetting admin on '${network.name}'...`);

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

  // Set admin
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const tx = await rigs.setAdmin(rigsConfig.admin);
  const receipt = await tx.wait();
  console.log(`set admin with txn '${receipt.transactionHash}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
