import { ethers, network, rigsDeployment } from "hardhat";
import { TablelandRigs } from "../typechain-types";
import { getContractURI } from "../helpers/uris";

async function main() {
  console.log(`\nSetting contract URI on '${network.name}'...`);

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
  if (rigsDeployment.contractTable === "") {
    throw Error(`missing contract table entry in deployments`);
  }

  // Update URI template
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const contractURI = getContractURI(
    rigsDeployment.tablelandHost,
    rigsDeployment.contractTable
  );
  const tx = await rigs.setContractURI(contractURI);
  const receipt = await tx.wait();
  console.log(
    `contract URI set to '${contractURI}' with txn '${receipt.transactionHash}'`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
