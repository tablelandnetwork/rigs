import { ethers, network, rigsDeployment } from "hardhat";
import { TablelandRigs } from "../typechain-types";

async function main() {
  console.log(`\nSetting pilots on '${network.name}'...`);

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

  if (
    rigsDeployment.pilotsAddress === "" ||
    rigsDeployment.pilotsAddress === ethers.constants.AddressZero
  ) {
    throw Error("invalid pilot address");
  }

  // Update mint phase
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const tx = await rigs.initPilots(rigsDeployment.pilotsAddress);
  const receipt = await tx.wait();
  console.log(
    `pilots set to '${rigsDeployment.pilotsAddress}' with txn '${receipt.transactionHash}'`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
