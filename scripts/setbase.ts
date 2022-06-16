import { ethers, network, baseURI, deployment } from "hardhat";

async function main() {
  console.log(`\nUpdating base URI on '${network.name}'...`);

  // Get proxy owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get contract address
  if (deployment === undefined || deployment === "") {
    throw Error(`missing deployments entry for '${network.name}'`);
  }
  console.log(`Using address '${deployment}'`);

  // Get new base URI
  if (baseURI === undefined || baseURI === "") {
    throw Error(`missing baseURIs entry for '${network.name}'`);
  }
  console.log(`Using base URI '${baseURI}'`);

  // Update base URI
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    deployment
  );
  const tx = await rigs.setBaseURI(baseURI);
  const receipt = await tx.wait();
  console.log(`base URI set with tx '${receipt.transactionHash}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
