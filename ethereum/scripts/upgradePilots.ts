import { ethers, upgrades, network, rigsDeployment } from "hardhat";
import type { TablelandRigPilots } from "../typechain-types";
import assert from "assert";

async function main() {
  console.log(`\nUpgrading on '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get proxy address
  if (rigsDeployment.pilotsAddress === "") {
    throw Error(`no pilotsAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsDeployment.pilotsAddress}'`);

  // Check current implementation
  const impl = await upgrades.erc1967.getImplementationAddress(
    rigsDeployment.pilotsAddress
  );
  console.log("Current implementation address:", impl);

  // Upgrade proxy
  const Factory = await ethers.getContractFactory("TablelandRigPilots");
  const pilots = await (
    (await upgrades.upgradeProxy(rigsDeployment.pilotsAddress, Factory, {
      kind: "uups",
    })) as TablelandRigPilots
  ).deployed();
  assert(
    pilots.address === rigsDeployment.pilotsAddress,
    "pilots address changed"
  );

  // Check new implementation
  const impl2 = await upgrades.erc1967.getImplementationAddress(pilots.address);
  console.log("New implementation address:", impl2);

  // TMP: Manually initialize impl. Once RIG-30 is done we can remove this.
  const pilotsImpl = Factory.attach(impl2) as TablelandRigPilots;
  const tx = await pilotsImpl.initialize(rigsDeployment.contractAddress);
  const receipt = await tx.wait();
  console.log(`Initialized new impl with txn '${receipt.transactionHash}'`);

  // Warn if implementation did not change, ie, nothing happened.
  if (impl === impl2) {
    console.warn("\nProxy implementation did not change. Is this expected?");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
