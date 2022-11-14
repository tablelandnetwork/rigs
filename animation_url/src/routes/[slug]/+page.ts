import { connect } from "@tableland/sdk";
import { deployments } from "@tableland/rigs/deployments";

const chain = import.meta.env.DEV ? "polygon-mumbai" : "ethereum";
const deployment = deployments[chain];
const ipfsGatewayUri = "https://nftstorage.link/ipfs/";

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
  const tableland = connect({ chain });

  // get rig id, allowing for .html suffix
  let rigId = url.pathname;
  const parts = rigId.replace(/^\/|\/$/g, "").split(".");
  rigId = parts[0];

  // get image
  const stm = `select json_object(
    'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name
  ) from ${deployment.attributesTable} join ${deployment.lookupsTable} where rig_id=${rigId} group by rig_id;`;
  const metadata = await tableland.read(stm, {
    output: "objects",
    extract: true,
    unwrap: true,
  });
  const httpUri = ipfsGatewayUri + metadata.image.slice(7);

  // get pilot
  let pilot;
  const sessions = await tableland.read(
    `SELECT end_time FROM ${deployment.pilotSessionsTable} WHERE rig_id = ${rigId} AND end_time is null;`,
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
