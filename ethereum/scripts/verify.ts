import { BigNumber } from "ethers";
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
  if (rigsDeployment.votingContractAddress === "") {
    throw Error(`no votingContractAddress entry for '${network.name}'`);
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

  // Verify voting contract
  try {
    const pilotSessionsTableId =
      rigsDeployment.pilotSessionsTable.match(/.*_\d*_(\d*)/)![1];
    const ftRewardsTableId =
      rigsDeployment.ftRewardsTable.match(/.*_\d*_(\d*)/)![1];
    const proposalsTableId =
      rigsDeployment.proposalsTable.match(/.*_\d*_(\d*)/)![1];
    const ftSnapshotTableId =
      rigsDeployment.ftSnapshotTable.match(/.*_\d*_(\d*)/)![1];
    const votesTableId = rigsDeployment.votesTable.match(/.*_\d*_(\d*)/)![1];
    const optionsTableId =
      rigsDeployment.optionsTable.match(/.*_\d*_(\d*)/)![1];

    await run("verify:verify", {
      address: rigsDeployment.votingContractAddress,
      constructorArguments: [
        {
          id: BigNumber.from(proposalsTableId),
          name: rigsDeployment.proposalsTable,
        },
        {
          id: BigNumber.from(ftSnapshotTableId),
          name: rigsDeployment.ftSnapshotTable,
        },
        { id: BigNumber.from(votesTableId), name: rigsDeployment.votesTable },
        {
          id: BigNumber.from(optionsTableId),
          name: rigsDeployment.optionsTable,
        },
        {
          id: BigNumber.from(pilotSessionsTableId),
          name: rigsDeployment.pilotSessionsTable,
        },
        {
          id: BigNumber.from(ftRewardsTableId),
          name: rigsDeployment.ftRewardsTable,
        },
        BigNumber.from(0),
      ],
    });
  } catch (err) {
    if (
      err.message === "Contract source code already verified" ||
      err.message.includes("Reason: Already Verified")
    ) {
      console.log(
        `Voting contract already verified: '${rigsDeployment.votingContractAddress}'`
      );
    } else throw err;
  }

  // Verify missions contract
  try {
    const missionsTable =
      rigsDeployment.missionsTable.match(/.*_\d*_(\d*)/)![1];
    const missionContributionsTable =
      rigsDeployment.missionContributionsTable.match(/.*_\d*_(\d*)/)![1];

    await run("verify:verify", {
      address: rigsDeployment.missionContractAddress,
      constructorArguments: [
        {
          id: BigNumber.from(missionsTable),
          name: rigsDeployment.missionsTable,
        },
        {
          id: BigNumber.from(missionContributionsTable),
          name: rigsDeployment.missionContributionsTable,
        },
      ],
    });
  } catch (err) {
    if (
      err.message === "Contract source code already verified" ||
      err.message.includes("Reason: Already Verified")
    ) {
      console.log(
        `Missions contract already verified: '${rigsDeployment.missionContractAddress}'`
      );
    } else throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
