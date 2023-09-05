import { ethers, network, rigsConfig, rigsDeployment, mainnet } from "hardhat";
import { Wallet, providers, Signer, BigNumber } from "ethers";
import type { MissionsManager } from "../typechain-types";
import { Database } from "@tableland/sdk";

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  const tablesConfig = mainnet
    ? rigsConfig.tables.mainnet
    : network.name === "hardhat"
    ? rigsConfig.tables.localhost
    : rigsConfig.tables.testnet;

  let signer: Signer;
  if (tablesConfig.tablelandPrivateKey) {
    signer = new Wallet(tablesConfig.tablelandPrivateKey);
  } else if (account) {
    signer = account;
    console.log("Using default signer for creating tables");
  } else {
    throw Error("missing signer/Tableland private key");
  }

  if (tablesConfig.tablelandAlchemyKey) {
    const provider = new providers.AlchemyProvider(
      rigsDeployment.tablelandChain,
      tablesConfig.tablelandAlchemyKey
    );
    signer = signer.connect(provider);
  }

  const db = new Database({ signer, autoWait: true });

  // Create missions table
  const { meta: missionsMeta } = await db
    .prepare(
      `
      CREATE TABLE missions (
        id integer primary key,
        name text not null,
        description text not null,
        tags text not null,
        requirements text not null,
        rewards text not null,
        deliverables text not null,
        contributions_start_block integer not null default 0,
        contributions_end_block integer not null default 0,
        max_number_of_contributions integer not null default 0,
        contributions_disabled integer not null default 0
      )`
    )
    .run();

  const missionsReceipt = await missionsMeta.txn!.wait();
  const missionsTableName = missionsReceipt.name;
  const missionsTableId = missionsReceipt.tableId;

  // NOTE accepted is nullable, because it will go from null -> true/false when reviewed
  const { meta: contributionsMeta } = await db
    .prepare(
      `
      CREATE TABLE mission_contributions (
        id integer primary key,
        contributor text not null,
        mission_id integer not null,
        created_at integer not null,
        data text not null,

        accepted integer,
        acceptance_motivation text
      )`
    )
    .run();

  const contributionsReceipt = await contributionsMeta.txn!.wait();
  const contributionsTableName = contributionsReceipt.name;
  const contributionsTableId = contributionsReceipt.tableId;

  // Deploy contract
  const MissionsManager = await ethers.getContractFactory("MissionsManager");
  const missionsManager = (await MissionsManager.deploy(
    {
      id: BigNumber.from(missionsTableId),
      name: missionsTableName,
    },
    {
      id: BigNumber.from(contributionsTableId),
      name: contributionsTableName,
    }
  )) as MissionsManager;

  await missionsManager.deployed();
  console.log(
    `deployed missions manager contract with address ${missionsManager.address}`
  );

  // Grant contract permission to write to the necessary tables
  await db
    .prepare(
      `GRANT UPDATE ON ${missionsTableName} TO '${missionsManager.address}'`
    )
    .run();
  console.log(
    `granted update on ${missionsTableName} to ${missionsManager.address}`
  );
  await db
    .prepare(
      `GRANT INSERT, UPDATE ON ${contributionsTableName} TO '${missionsManager.address}'`
    )
    .run();
  console.log(
    `granted insert, update on ${contributionsTableName} to ${missionsManager.address}`
  );

  // Warn that addresses and table names need to be saved in deployments file
  console.warn(
    `\nSave 'deployments.${network.name}.missionsContractAddress: "${missionsManager.address}"' in deployments.ts!`
  );
  console.warn(
    `\nSave 'deployments.${network.name}.missionsTable: "${missionsTableName}"' in deployments.ts!`
  );
  console.warn(
    `\nSave 'deployments.${network.name}.missionContributionsTable: "${contributionsTableName}"' in deployments.ts!\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
