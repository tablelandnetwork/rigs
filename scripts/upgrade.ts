import { ethers, upgrades, network, rigsDeployment } from "hardhat";
import type { TablelandRigs } from "../typechain-types";
import assert from "assert";

async function main() {
  console.log(`\nUpgrading on '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get proxy address
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsDeployment.contractAddress}'`);

  // Check current implementation
  const impl = await upgrades.erc1967.getImplementationAddress(
    rigsDeployment.contractAddress
  );
  console.log("Current implementation address:", impl);

  // Upgrade proxy
  const Factory = await ethers.getContractFactory("TablelandRigs");
  const rigs = await (
    (await upgrades.upgradeProxy(rigsDeployment.contractAddress, Factory, {
      kind: "uups",
    })) as TablelandRigs
  ).deployed();
  assert(
    rigs.address === rigsDeployment.contractAddress,
    "contract address changed"
  );

  // Check new implementation
  const impl2 = await upgrades.erc1967.getImplementationAddress(rigs.address);
  console.log("New implementation address:", impl2);

  // Warn if implementation did not change, ie, nothing happened.
  if (impl === impl2) {
    console.warn("\nProxy implementation did not change. Is this expected?");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
