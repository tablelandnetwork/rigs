import { ethers, network, rigsConfig, rigsDeployment, mainnet } from "hardhat";
import { Wallet, providers, Signer, BigNumber } from "ethers";
import type { VotingRegistry } from "../typechain-types";
import { Database } from "@tableland/sdk";

process.on("warning", (e) => console.warn(e.stack));

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Don't allow multiple deployments per network
  if (rigsDeployment.votingContractAddress !== "") {
    throw Error(`already deployed to '${network.name}'`);
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

  if (tablesConfig.tablelandProviderUrl) {
    const provider = new providers.JsonRpcProvider(
      tablesConfig.tablelandProviderUrl
    );
    signer = signer.connect(provider);
  }

  const db = new Database({ signer, autoWait: true });

  // Check that we have ft rewards & proposals table available
  const pilotSessionsTableName = rigsDeployment.pilotSessionsTable;
  if (!/.*_\d*_\d*/.test(pilotSessionsTableName)) {
    throw Error(`no pilotSessionsTable available on '${network.name}'`);
  }

  const ftRewardsTableName = rigsDeployment.ftRewardsTable;
  if (!/.*_\d*_\d*/.test(ftRewardsTableName)) {
    throw Error(`no ftRewardsTable available on '${network.name}'`);
  }

  const pilotSessionsTableId =
    rigsDeployment.pilotSessionsTable.match(/.*_\d*_(\d*)/)![1];
  const ftRewardsTableId =
    rigsDeployment.ftRewardsTable.match(/.*_\d*_(\d*)/)![1];

  // Create proposals table
  const { meta: proposalsMeta } = await db
    .prepare(
      "CREATE TABLE proposals (id integer NOT NULL, name text NOT NULL, description_cid text, voting_system integer NOT NULL, voter_ft_reward integer NOT NULL, created_at integer NOT NULL, start_block integer NOT NULL, end_block integer NOT NULL)"
    )
    .run();

  const proposalsReceipt = await proposalsMeta.txn!.wait();
  const proposalsTableName = proposalsReceipt.name;
  const proposalsTableId = proposalsReceipt.tableId;
  console.log(`proposals table created as ${proposalsTableName}`);

  // Create ft snapshot table
  const { meta: ftSnapshotMeta } = await db
    .prepare(
      "CREATE TABLE ft_snapshot (address text NOT NULL, ft integer NOT NULL, proposal_id integer NOT NULL, UNIQUE(address, proposal_id))"
    )
    .run();

  const ftSnapshotReceipt = await ftSnapshotMeta.txn!.wait();
  const ftSnapshotTableName = ftSnapshotReceipt.name;
  const ftSnapshotTableId = ftSnapshotReceipt.tableId;
  console.log(`ft_snapshot table created as ${ftSnapshotTableName}`);

  // Create votes table
  const { meta: votesMeta } = await db
    .prepare(
      "CREATE TABLE votes (address text NOT NULL, proposal_id integer NOT NULL, option_id integer NOT NULL, weight integer NOT NULL, comment text, UNIQUE(address, option_id, proposal_id))"
    )
    .run();

  const votesReceipt = await votesMeta.txn!.wait();
  const votesTableName = votesReceipt.name;
  const votesTableId = votesReceipt.tableId;
  console.log(`votes table created as ${votesTableName}`);

  // Create options table
  const { meta: optionsMeta } = await db
    .prepare(
      "CREATE TABLE options (id integer NOT NULL, proposal_id integer NOT NULL, description text NOT NULL)"
    )
    .run();

  const optionsReceipt = await optionsMeta.txn!.wait();
  const optionsTableName = optionsReceipt.name;
  const optionsTableId = optionsReceipt.tableId;
  console.log(`options table created as ${optionsTableName}`);

  // Deploy contract
  const VotingRegistryFactory = await ethers.getContractFactory(
    "VotingRegistry"
  );
  const votingRegistry = (await VotingRegistryFactory.deploy(
    { id: BigNumber.from(proposalsTableId), name: proposalsTableName },
    { id: BigNumber.from(ftSnapshotTableId), name: ftSnapshotTableName },
    { id: BigNumber.from(votesTableId), name: votesTableName },
    { id: BigNumber.from(optionsTableId), name: optionsTableName },
    { id: BigNumber.from(pilotSessionsTableId), name: pilotSessionsTableName },
    { id: BigNumber.from(ftRewardsTableId), name: ftRewardsTableName },
    BigNumber.from(0)
  )) as VotingRegistry;

  await votingRegistry.deployed();
  console.log(
    `deployed voting registry contract with address ${votingRegistry.address}`
  );

  // Grant contract permission to write to the necessary tables
  await db
    .prepare(
      `GRANT INSERT ON ${proposalsTableName} TO '${votingRegistry.address}'`
    )
    .run();
  console.log(
    `granted insert on ${proposalsTableName} to ${votingRegistry.address}`
  );

  await db
    .prepare(
      `GRANT INSERT ON ${ftSnapshotTableName} TO '${votingRegistry.address}'`
    )
    .run();
  console.log(
    `granted insert on ${ftSnapshotTableName} to ${votingRegistry.address}`
  );

  await db
    .prepare(
      `GRANT INSERT, UPDATE ON ${votesTableName} TO '${votingRegistry.address}'`
    )
    .run();
  console.log(
    `granted insert, update on ${votesTableName} to ${votingRegistry.address}`
  );

  await db
    .prepare(
      `GRANT INSERT ON ${optionsTableName} TO '${votingRegistry.address}'`
    )
    .run();
  console.log(
    `granted insert on ${optionsTableName} to ${votingRegistry.address}`
  );

  const { meta: grantMeta } = await db
    .prepare(
      `GRANT INSERT ON ${ftRewardsTableName} TO '${votingRegistry.address}'`
    )
    .run();

  await grantMeta.txn?.wait();
  console.log(
    `granted insert on ${ftRewardsTableName} to ${votingRegistry.address}`
  );

  // Warn that addresses and table names need to be saved in deployments file
  console.warn(
    `\nSave 'deployments.${network.name}.votingContractAddress: "${votingRegistry.address}"' in deployments.ts!`
  );
  console.warn(
    `\nSave 'deployments.${network.name}.proposalsTable: "${proposalsTableName}"' in deployments.ts!`
  );
  console.warn(
    `\nSave 'deployments.${network.name}.ftSnapshotTable: "${ftSnapshotTableName}"' in deployments.ts!`
  );
  console.warn(
    `\nSave 'deployments.${network.name}.votesTable: "${votesTableName}"' in deployments.ts!`
  );
  console.warn(
    `\nSave 'deployments.${network.name}.optionsTable: "${optionsTableName}"' in deployments.ts!`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
