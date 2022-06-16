import { ethers, network, baseURI, deployment } from "hardhat";
import type { TablelandRigs } from "../typechain-types";

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
  const Factory = await ethers.getContractFactory("TablelandRigs");
  const rigs = (await Factory.deploy(baseURI)) as TablelandRigs;
  await rigs.deployed();

  console.log("New address:", rigs.address);

  // Warn that address needs to be saved in config
  console.warn(
    `\nSave 'deployments.${network.name}: "${rigs.address}"' in the hardhat config!`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
