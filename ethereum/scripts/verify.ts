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
  if (rigsDeployment.pilotsAddress === "") {
    throw Error(`no pilotsAddress entry for '${network.name}'`);
  }

  // Verify rigs
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  );
  let impl = await upgrades.erc1967.getImplementationAddress(rigs.address);
  await run("verify:verify", {
    address: impl,
  });

  // Verify pilots
  const pilots = (await ethers.getContractFactory("TablelandRigPilots")).attach(
    rigsDeployment.pilotsAddress
  );
  impl = await upgrades.erc1967.getImplementationAddress(pilots.address);
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
