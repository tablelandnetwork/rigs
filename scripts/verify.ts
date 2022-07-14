import {
  run,
  ethers,
  upgrades,
  network,
  rigsConfig,
  rigsDeployment,
} from "hardhat";

async function main() {
  console.log(`\nVerifying on '${network.name}'...`);

  // Ensure deployments
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  if (rigsDeployment.royaltyContractAddress === "") {
    throw Error(`no royaltyContractAddress entry for '${network.name}'`);
  }

  // Verify rigs
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  );
  const impl = await upgrades.erc1967.getImplementationAddress(rigs.address);
  await run("verify:verify", {
    address: impl,
  });

  // Verify royalties contract
  await run("verify:verify", {
    address: rigsDeployment.royaltyContractAddress,
    constructorArguments: [
      rigsConfig.royaltyReceivers,
      rigsConfig.royaltyReceiverShares,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
