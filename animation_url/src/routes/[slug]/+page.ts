import { connect } from "@tableland/sdk";
import { deployments } from "ethereum/deployments";

const chain = "polygon-mumbai"; // "ethereum"

const attributesTable = deployments[chain].attributesTable;
const lookupsTable = deployments[chain].lookupsTable;
const pilotSessionsTable = deployments[chain].pilotSessionsTable;
const ipfsGatewayUri = "https://nftstorage.link/ipfs/";

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
  const tableland = connect({ chain: "polygon-mumbai" });

  // get rig id, allowing for .html suffix
  let rigId = url.pathname;
  const parts = rigId.replace(/^\/|\/$/g, "").split(".");
  rigId = parts[0];

  // get image
  const stm = `select json_object(
    'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name
  ) from ${attributesTable} join ${lookupsTable} where rig_id=${rigId} group by rig_id;`;
  const metadata = await tableland.read(stm, {
    output: "objects",
    extract: true,
    unwrap: true,
  });
  const httpUri = ipfsGatewayUri + metadata.image.slice(7);

  // get pilot
  let pilot;
  const sessions = await tableland.read(
    `SELECT end_time FROM ${pilotSessionsTable} WHERE rig_id = ${rigId} AND end_time is null;`,
    { output: "objects" }
  );
  if (sessions && sessions.length > 0) {
    pilot = "trainer_pilot.svg";
  }

  return {
    imageUrl: httpUri,
    badges: [],
    pilot,
  };
}

/* NOTE: badge handling logic to be used later

// await tableland.read(
//   `SELECT * FROM ${rigBadgesTableName} WHERE rig_id = ${rigId};`,
//   { output: "objects" }
// );
// TODO: get the badges via tableland
const allBadges = [
  "TableLand_Icons-01.svg",
  "TableLand_Icons-02.svg",
  "TableLand_Icons-03.svg",
  "TableLand_Icons-04.svg",
  "TableLand_Icons-05.svg",
  "TableLand_Icons-06.svg"
];

// TODO: remove this when we are rendering real badge data
//       until then you can choose a number of badges to show for manual testing,
//       the max visible as of 2022/10/06 is 11
const totalRigBadgesLength = 117;
const totalRigBadges = [];
for (let i = 0; i < totalRigBadgesLength; i++) {
  totalRigBadges.push(allBadges[Math.floor(Math.random() * 100) % allBadges.length]);
}

const maxBadges = 11;
const badges = [];
for (let i = 0; i < maxBadges; i++) {
  // TODO: pick a random image until we have a way to query for badges
  const nextBadge = totalRigBadges[i];
  if (!nextBadge) break;

  badges.push(nextBadge);
}

*/
