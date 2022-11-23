import { ethers, upgrades, network, rigsDeployment } from "hardhat";
import type { TablelandRigPilots } from "../typechain-types";

async function main() {
  console.log(`\nDeploying pilots to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Don't allow multiple deployments per network
  if (rigsDeployment.pilotsAddress !== "") {
    throw Error(`already deployed to '${network.name}'`);
  }

  // Get contract address
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  console.log(`Using contract address '${rigsDeployment.contractAddress}'`);

  // Deploy Pilots
  const RigPilotsFactory = await ethers.getContractFactory(
    "TablelandRigPilots"
  );
  const pilots = await (
    (await upgrades.deployProxy(
      RigPilotsFactory,
      [rigsDeployment.contractAddress],
      {
        kind: "uups",
      }
    )) as TablelandRigPilots
  ).deployed();
  console.log("Deployed Pilots:", pilots.address);
  const pilotSessionsTable = await pilots.pilotSessionsTable();
  console.log("Pilot sessions table:", pilotSessionsTable);

  // Warn that addresses need to be saved in deployments file
  console.warn(
    `\nSave 'deployments.${network.name}.pilotsAddress: "${pilots.address}"' in deployments.ts!`,
    `\nSave 'deployments.${network.name}.pilotSessionsTable: "${pilotSessionsTable}"' in deployments.ts!`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
