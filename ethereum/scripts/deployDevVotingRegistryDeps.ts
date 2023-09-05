import { ethers, network } from "hardhat";
import { getDatabase } from "@tableland/local";

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  const db = getDatabase(account);

  const { meta: pilotSessionsMeta } = await db
    .prepare(
      "CREATE TABLE pilot_sessions (id integer primary key, rig_id integer NOT NULL, owner text NOT NULL, pilot_contract text, pilot_id integer, start_time integer NOT NULL, end_time integer)"
    )
    .all();

  const pilotSessionReceipt = await pilotSessionsMeta.txn!.wait();
  const pilotSessionsTableName = pilotSessionReceipt.name;

  const { meta: ftRewardsMeta } = await db
    .prepare(
      "CREATE TABLE ft_rewards (block_num integer NOT NULL, recipient text NOT NULL, reason text NOT NULL, amount integer NOT NULL, proposal_id integer)"
    )
    .all();

  const ftRewardsReceipt = await ftRewardsMeta.txn!.wait();
  const ftRewardsTableName = ftRewardsReceipt.name;

  console.warn(
    `\nSave 'deployments.${network.name}.pilotSessionsTable : "${pilotSessionsTableName}"' in deployments.ts!`
  );
  console.warn(
    `\nSave 'deployments.${network.name}.ftRewardsTable: "${ftRewardsTableName}"' in deployments.ts!`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
