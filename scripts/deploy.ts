import { ethers, network, baseURI, deployment } from "hardhat";
import { BigNumber, utils } from "ethers";
import type { TablelandRigs, PaymentSplitter } from "../typechain-types";

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get base URI
  if (baseURI === undefined || baseURI === "") {
    throw Error(`missing baseURIs entry for '${network.name}'`);
  }
  console.log(`Using base URI '${baseURI}'`);

  // Don't allow multiple deployments per network
  if (deployment !== "") {
    throw Error(`already deployed to '${network.name}'`);
  }

  // Deploy
  const SplitterFactory = await ethers.getContractFactory("PaymentSplitter");
  const splitter = (await SplitterFactory.deploy(
    [
      "0xE2ECC1552111f9E78342F79b5f5e87877CF57b8F",
      "0xF4A070a7Fe619cb1996De0cEaE45b806Eb5ceC65",
    ],
    [20, 80]
  )) as PaymentSplitter;
  await splitter.deployed();

  console.log("New splitter address:", splitter.address);

  const RigsFactory = await ethers.getContractFactory("TablelandRigs");
  const rigs = (await RigsFactory.deploy(
    BigNumber.from(1000),
    utils.parseEther("0.05"),
    baseURI,
    "0x4D13f1C893b4CaFAF791501EDACA331468FEfeDe",
    splitter.address
  )) as TablelandRigs;
  await rigs.deployed();

  console.log("New rigs address:", rigs.address);

  // Warn that address needs to be saved in config
  console.warn(
    `\nSave 'deployments.${network.name}: "${rigs.address}"' in the hardhat config!`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
