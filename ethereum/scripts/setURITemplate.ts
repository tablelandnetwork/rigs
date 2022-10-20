import { ethers, network, rigsDeployment } from "hardhat";
import { TablelandRigs } from "../typechain-types";
import { getURITemplate } from "../helpers/uris";

async function main() {
  console.log(`\nUpdating base URI on '${network.name}'...`);

  // Get proxy owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get contract address
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsDeployment.contractAddress}'`);

  // Ensure we can build URI template
  if (rigsDeployment.attributesTable === "") {
    throw Error(`missing attributes table entry in deployments`);
  }
  if (rigsDeployment.lookupsTable === "") {
    throw Error(`missing lookups table entry in deployments`);
  }

  // Get pilots table
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const pilotsTable = await rigs.pilotsTable();

  // Update URI template
  const uriTemplate = getURITemplate(
    rigsDeployment.tablelandHost,
    rigsDeployment.attributesTable,
    rigsDeployment.lookupsTable,
    pilotsTable,
    rigsDeployment.displayAttributes
  );
  const tx = await rigs.setURITemplate(uriTemplate);
  const receipt = await tx.wait();
  console.log(
    `URI template set to '${uriTemplate}' with txn '${receipt.transactionHash}'`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
