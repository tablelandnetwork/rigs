import { Database } from "@tableland/sdk";
import { deployments } from "@tableland/rigs/deployments";
import { Network, Alchemy, NftTokenType } from "alchemy-sdk";
import { default as trainer } from "../../assets/trainer.svg";
import { default as unknown } from "../../assets/unknown.svg";

const chain = import.meta.env.DEV ? "polygon-mumbai" : "ethereum";
const deployment = deployments[chain];

const ipfsGatewayUri = import.meta.env.DEV
  ? "https://nftstorage.link/ipfs/"
  : "https://tableland.mypinata.cloud/ipfs/";

const db = new Database();
const alchemy = new Alchemy({
  apiKey: import.meta.env.VITE_ALCHEMY_ID,
  network: import.meta.env.DEV ? Network.MATIC_MUMBAI : Network.ETH_MAINNET,
});

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
  // get rig id, allowing for .html suffix
  let rigId = url.pathname;
  const parts = rigId.replace(/^\/|\/$/g, "").split(".");
  rigId = parts[0];

  // get image
  const stm = `SELECT renders_cid, (select value from ${deployment.lookupsTable} where label = 'image_medium_name') image_medium_name FROM ${deployment.rigsTable} WHERE id = ${rigId};`

  const {
    renders_cid,
    image_medium_name
  } = await db.prepare(stm).first<{ renders_cid: string, image_medium_name: string }>();

  const image = `ipfs://${renders_cid}/${image_medium_name}`;
  const httpUri = ipfsGatewayUri + image.slice(7);

  // get pilot
  const pilot = await getPilot(rigId);

  return {
    imageUrl: httpUri,
    badges: [],
    pilot,
  };
}

const getPilot = async function (rigId: string): Promise<string | undefined> {
  // Get the sessions where end_time is null, there should only ever be one of these
  const res = await db.prepare(
    `SELECT pilot_contract,pilot_id FROM ${deployment.pilotSessionsTable} WHERE rig_id = ${rigId} AND end_time is null;`
  ).all<{ pilot_contract: string; pilot_id: string; }>();

  const sessions = res.results;

  if (!(sessions && sessions.length > 0)) {
    // no session without an end_time, show nothing
    return undefined;
  }

  // there's a session without an end_time, show a pilot
  const session = sessions[0];
  let pilot: string;
  if (session.pilot_contract && session.pilot_id) {
    const pilotToken = await alchemy.nft.getNftMetadata(
      session.pilot_contract,
      session.pilot_id,
      NftTokenType.ERC721
    );

    const imageUrl =
      pilotToken?.media[0]?.thumbnail ||
      pilotToken?.media[0]?.gateway ||
      pilotToken?.media[0]?.raw;
    const imageData = pilotToken?.rawMetadata?.image_data;
    const svgImageData = pilotToken?.rawMetadata?.svg_image_data;

    pilot = imageUrl || imageData || svgImageData || unknown;
  } else {
    // else show trainer
    pilot = trainer;
  }
  return encodeSVG(pilot);
};

const encodeSVG = function (uri: string): string {
  if (uri.startsWith("data:image/svg+xml;utf8,")) {
    const parts = uri.split("data:image/svg+xml;utf8,");
    if (parts.length !== 2) {
      return unknown;
    }
    return "data:image/svg+xml;base64," + btoa(parts[1]);
  } else {
    return uri;
  }
};
