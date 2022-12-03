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
  try {
    await run("verify:verify", {
      address: impl,
    });
  } catch (err) {
    // Check if the error is via hardhat or etherscan where already verified contracts throw a halting error
    // If it's an etherscan issue, "Reason: Already Verified" is embedded within a hardhat error message
    if (
      err.message === "Contract source code already verified" ||
      err.message.includes("Reason: Already Verified")
    ) {
      console.log(
        `Rigs contract already verified: '${rigsDeployment.contractAddress}'`
      );
    } else throw err;
  }

  // Verify pilots
  const pilots = (await ethers.getContractFactory("TablelandRigPilots")).attach(
    rigsDeployment.pilotsAddress
  );
  impl = await upgrades.erc1967.getImplementationAddress(pilots.address);
  try {
    await run("verify:verify", {
      address: impl,
    });
  } catch (err) {
    if (
      err.message === "Contract source code already verified" ||
      err.message.includes("Reason: Already Verified")
    ) {
      console.log(
        `Pilots contract already verified: '${rigsDeployment.pilotsAddress}'`
      );
    } else throw err;
  }

  // Verify royalties contract
  try {
    await run("verify:verify", {
      address: rigsDeployment.royaltyContractAddress,
      constructorArguments: [
        rigsConfig.royaltyReceivers,
        rigsConfig.royaltyReceiverShares,
      ],
    });
  } catch (err) {
    if (
      err.message === "Contract source code already verified" ||
      err.message.includes("Reason: Already Verified")
    ) {
      console.log(
        `Royalties contract already verified: '${rigsDeployment.royaltyContractAddress}'`
      );
    } else throw err;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
