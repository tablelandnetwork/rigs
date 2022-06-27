import { run, network, rigsConfig } from "hardhat";
import { BigNumber, utils } from "ethers";

async function main() {
  console.log(`\nVerifying on '${network.name}'...`);

  // Get URI template
  if (rigsConfig.uriTemplate === undefined || rigsConfig.uriTemplate === "") {
    throw Error(`missing uriTemplate entry for '${network.name}'`);
  }

  // Ensure deployments
  if (rigsConfig.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  if (rigsConfig.royaltyContractAddress === "") {
    throw Error(`no royaltyContractAddress entry for '${network.name}'`);
  }

  await run("verify:verify", {
    address: rigsConfig.contractAddress,
    constructorArguments: [
      BigNumber.from(rigsConfig.maxSupply),
      utils.parseEther(rigsConfig.etherPrice),
      rigsConfig.uriTemplate,
      rigsConfig.beneficiary,
      rigsConfig.royaltyContractAddress,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
