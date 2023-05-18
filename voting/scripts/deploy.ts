import { ethers, network } from "hardhat";
import { VotingRegistry } from "../typechain-types";
import { Database, Validator } from "@tableland/sdk";
import { LocalTableland, getAccounts, getDatabase } from "@tableland/local";

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  const db = getDatabase(account);

  const { meta: pilotRewardsMeta } = await db
    .prepare(
      "CREATE TABLE pilot_sessions (id integer primary key, rig_id integer NOT NULL, owner text NOT NULL, pilot_contract text, pilot_id integer, start_time integer NOT NULL, end_time integer)"
    )
    .all();

  const pilotRewardsReceipt = await pilotRewardsMeta.txn!.wait();
  const pilotSessionsTableName = pilotRewardsReceipt.name;

  // 2. Create ftRewards table
  let { meta: ftRewardsMeta } = await db
    .prepare(
      "CREATE TABLE ft_rewards (block_num integer NOT NULL, recipient text NOT NULL, reason text NOT NULL, amount integer NOT NULL, proposal_id integer)"
    )
    .all();

  const ftRewardsReceipt = await ftRewardsMeta.txn!.wait();
  const ftRewardsTableName = ftRewardsReceipt.name;
  const ftRewardsTableId = ftRewardsReceipt.tableId;

  // Deploy
  const VotingRegistryFactory = await ethers.getContractFactory(
    "VotingRegistry"
  );
  const voter = (await VotingRegistryFactory.deploy(
    pilotSessionsTableName,
    ftRewardsTableName,
    ftRewardsTableId
  )) as VotingRegistry;

  await voter.deployed();

  console.log("Deployed VotingRegistry:", voter.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
