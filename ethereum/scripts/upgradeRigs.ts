import { ethers, upgrades, network, rigsDeployment, rigsConfig } from "hardhat";
import type { TablelandRigs } from "../typechain-types";
import assert from "assert";
import { BigNumber, utils } from "ethers";

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

  // TMP: Manually initialize impl. Once RIG-30 is done we can remove this.
  const rigsImpl = Factory.attach(impl2) as TablelandRigs;
  const tx = await rigsImpl.initialize(
    BigNumber.from(rigsConfig.maxSupply),
    utils.parseEther(rigsConfig.etherPrice),
    rigsConfig.feeRecipient,
    rigsDeployment.royaltyContractAddress,
    "0xcb3e8f37cd26c729d6ed94f151517549508020b191327dc78c7657bbd2872a50",
    "0xe45a43693f3688d2d97d6e933af863b80f24517da45579e157c6da40b71d77a2"
  );
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
