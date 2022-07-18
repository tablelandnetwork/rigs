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

  // Get URI template
  if (rigsDeployment.tokensTable === "") {
    throw Error(`missing table names entries in config`);
  }

  const uriTemplate = getURITemplate(
    rigsDeployment.tablelandHost,
    rigsDeployment.tokensTable,
    rigsDeployment.attributesTable
  );

  // Update base URI
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const tx = await rigs.setURITemplate(uriTemplate);
  const receipt = await tx.wait();
  console.log(`URI template set with txn '${receipt.transactionHash}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
