import { ethers, network, rigsConfig } from "hardhat";

async function main() {
  console.log(`\nUpdating base URI on '${network.name}'...`);

  // Get proxy owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get contract address
  if (
    rigsConfig.contractAddress === undefined ||
    rigsConfig.contractAddress === ""
  ) {
    throw Error(`missing contractAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsConfig.contractAddress}'`);

  // Get URI template
  if (rigsConfig.uriTemplate === undefined || rigsConfig.uriTemplate === "") {
    throw Error(`missing uriTemplate entry for '${network.name}'`);
  }

  // Update base URI
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsConfig.contractAddress
  );
  const tx = await rigs.setURITemplate(rigsConfig.uriTemplate);
  const receipt = await tx.wait();
  console.log(`URI template set with tx '${receipt.transactionHash}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
