import { ethers, network, rigsDeployment } from "hardhat";
import { TablelandRigs } from "../typechain-types";
import { getURITemplate } from "../helpers/uris";

async function main() {
  console.log(`\nSetting URI template on '${network.name}'...`);

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
  if (rigsDeployment.rigsTable === "") {
    throw Error(`missing rigs table entry in deployments`);
  }
  if (rigsDeployment.attributesTable === "") {
    throw Error(`missing attributes table entry in deployments`);
  }
  if (rigsDeployment.lookupsTable === "") {
    throw Error(`missing lookups table entry in deployments`);
  }
  if (rigsDeployment.dealsTable === "") {
    throw Error(`missing deals table entry in deployments`);
  }
  if (rigsDeployment.pilotSessionsTable === "") {
    throw Error(`missing pilot sessions table entry in deployments`);
  }

  // Update URI template
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const uriTemplate = await getURITemplate(
    rigsDeployment.tablelandHost,
    rigsDeployment.rigsTable,
    rigsDeployment.attributesTable,
    rigsDeployment.dealsTable,
    rigsDeployment.lookupsTable,
    rigsDeployment.pilotSessionsTable,
    rigsDeployment.displayAttributes
  );
  const tx = await rigs.setURITemplate(uriTemplate);
  const receipt = await tx.wait();
  console.log(
    `URI template set to '${uriTemplate}' with txn '${receipt.transactionHash}'`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
