import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { VotingRegistry } from "../typechain-types";
import { getDatabase } from "@tableland/local";

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  const db = getDatabase(account);

  // 1. Create ftRewards table
  const { meta: pilotRewardsMeta } = await db
    .prepare(
      "CREATE TABLE pilot_sessions (id integer primary key, rig_id integer NOT NULL, owner text NOT NULL, pilot_contract text, pilot_id integer, start_time integer NOT NULL, end_time integer)"
    )
    .all();

  const pilotRewardsReceipt = await pilotRewardsMeta.txn!.wait();
  const pilotSessionsTableName = pilotRewardsReceipt.name;
  const pilotSessionsId = pilotRewardsReceipt.tableId;

  // 2. Create ftRewards table
  const { meta: ftRewardsMeta } = await db
    .prepare(
      "CREATE TABLE ft_rewards (block_num integer NOT NULL, recipient text NOT NULL, reason text NOT NULL, amount integer NOT NULL, proposal_id integer)"
    )
    .all();

  const ftRewardsReceipt = await ftRewardsMeta.txn!.wait();
  const ftRewardsTableName = ftRewardsReceipt.name;
  const ftRewardsTableId = ftRewardsReceipt.tableId;

  // 3. Create proposals table
  const { meta: proposalsMeta } = await db
    .prepare(
      "CREATE TABLE proposals (id integer NOT NULL, name text NOT NULL, description_cid text, voter_ft_reward integer NOT NULL, created_at integer NOT NULL, start_block integer NOT NULL, end_block integer NOT NULL)"
    )
    .all();

  const proposalsReceipt = await proposalsMeta.txn!.wait();
  const proposalsTableName = proposalsReceipt.name;
  const proposalsTableId = proposalsReceipt.tableId;

  // 4. Create ft snapshot table
  const { meta: ftSnapshotMeta } = await db
    .prepare(
      "CREATE TABLE ft_snapshot (address text NOT NULL, ft integer NOT NULL, proposal_id integer NOT NULL)"
    )
    .all();

  const ftSnapshotReceipt = await ftSnapshotMeta.txn!.wait();
  const ftSnapshotTableName = ftSnapshotReceipt.name;
  const ftSnapshotTableId = ftSnapshotReceipt.tableId;

  // 5. Create votes table
  const { meta: votesMeta } = await db
    .prepare(
      "CREATE TABLE votes (address text NOT NULL, proposal_id integer NOT NULL, option_id integer NOT NULL, weight integer NOT NULL, comment text, UNIQUE(address, option_id, proposal_id))"
    )
    .all();

  const votesReceipt = await votesMeta.txn!.wait();
  const votesTableName = votesReceipt.name;
  const votesTableId = votesReceipt.tableId;

  // 6. Create options table
  const { meta: optionsMeta } = await db
    .prepare(
      "CREATE TABLE options (id integer NOT NULL, proposal_id integer NOT NULL, description text NOT NULL)"
    )
    .all();

  const optionsReceipt = await optionsMeta.txn!.wait();
  const optionsTableName = optionsReceipt.name;
  const optionsTableId = optionsReceipt.tableId;

  // Deploy
  const VotingRegistryFactory = await ethers.getContractFactory(
    "VotingRegistry"
  );
  const votingRegistry = (await VotingRegistryFactory.deploy(
    { id: proposalsTableId, name: proposalsTableName },
    { id: ftSnapshotTableId, name: ftSnapshotTableName },
    { id: votesTableId, name: votesTableName },
    { id: optionsTableId, name: optionsTableName },
    { id: pilotSessionsId, name: pilotSessionsTableName },
    { id: ftRewardsTableId, name: ftRewardsTableName },
    BigNumber.from(0),
  )) as VotingRegistry;

  await votingRegistry.deployed();

  await db
    .prepare(`GRANT INSERT ON ${proposalsTableName} TO '${votingRegistry.address}'`)
    .run();
  await db
    .prepare(`GRANT INSERT ON ${ftSnapshotTableName} TO '${votingRegistry.address}'`)
    .run();
  await db
    .prepare(`GRANT INSERT, UPDATE ON ${votesTableName} TO '${votingRegistry.address}'`)
    .run();
  await db
    .prepare(`GRANT INSERT ON ${optionsTableName} TO '${votingRegistry.address}'`)
    .run();
  const { meta: grantMeta } = await db
    .prepare(`GRANT INSERT ON ${ftRewardsTableName} TO '${votingRegistry.address}'`)
    .run();

    await grantMeta.txn?.wait();

  // Warn that addresses and table names need to be saved in deployments file
  //
  console.warn(
    `\nSave 'deployments.${network.name}.votingContractAddress: "${votingRegistry.address}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.proposalsTable: "${proposalsTableName}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.ftSnapshotTable: "${ftSnapshotTableName}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.votesTable: "${votesTableName}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.optionsTable: "${optionsTableName}"' in deployments.ts!`
  );
  console.log('\n\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});