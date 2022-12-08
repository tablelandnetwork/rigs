import { connect } from "@tableland/sdk";
import { deployments } from "@tableland/rigs/deployments";
import { Network, Alchemy, NftTokenType } from "alchemy-sdk";
import { default as trainer } from "../../assets/trainer.svg";
import { default as unknown } from "../../assets/unknown.svg";

const chain = import.meta.env.DEV ? "polygon-mumbai" : "ethereum";
const deployment = deployments[chain];

const ipfsGatewayUri = import.meta.env.DEV
  ? "https://nftstorage.link/ipfs/"
  : "https://tableland.mypinata.cloud/ipfs/";

const tableland = connect({ chain, host: deployment.tablelandHost });
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
  const stm = `SELECT json_object(
    'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name
  ) FROM ${deployment.attributesTable} JOIN ${deployment.lookupsTable} WHERE rig_id=${rigId} GROUP BY rig_id;`;
  const metadata = await tableland.read(stm, {
    output: "objects",
    extract: true,
    unwrap: true,
  });
  const httpUri = ipfsGatewayUri + metadata.image.slice(7);

  // get pilot
  const pilot = await getPilot(rigId);

  return {
    imageUrl: httpUri,
    badges: [],
    pilot,
  };
}

type Pilot = {
  uri: string;
  type: MediaType;
};

enum MediaType {
  image = "image",
  video = "video",
}

const getPilot = async function (rigId: string): Promise<Pilot | undefined> {
  // Get the sessions where end_time is null, there should only ever be one of these
  const sessions = await tableland.read(
    `SELECT pilot_contract,pilot_id FROM ${deployment.pilotSessionsTable} WHERE rig_id = ${rigId} AND end_time is null;`,
    {
      output: "objects",
    }
  );

  if (!(sessions && sessions.length > 0)) {
    // no session without an end_time, show nothing
    return undefined;
  }

  // there's a session without an end_time, show a pilot
  const session = sessions[0];
  if (session.pilot_contract && session.pilot_id) {
    const pilotToken = await alchemy.nft.getNftMetadata(
      session.pilot_contract,
      session.pilot_id,
      NftTokenType.ERC721
    );
    if (pilotToken.media.length > 0 && pilotToken.media[0].gateway) {
      const uri = pilotToken.media[0].gateway;
      const type = getMediaType(uri);
      console.info("token info:", uri, type);
      if (!type) {
        return { uri: unknown, type: MediaType.image };
      }
      return { uri, type };
    } else {
      return { uri: unknown, type: MediaType.image };
    }
  }

  // else show trainer
  return { uri: trainer, type: MediaType.image };
};

const mediaTypes = new Map([
  ["jpg", MediaType.image],
  ["jpeg", MediaType.image],
  ["png", MediaType.image],
  ["gif", MediaType.image],
  ["mp4", MediaType.video],
  ["mov", MediaType.video],
  ["ogv", MediaType.video],
  ["webm", MediaType.video],
  ["3gp", MediaType.video],
]);

const getMediaType = function (uri: string): MediaType | undefined {
  const parts = uri.split(".");
  const extension = parts[parts.length - 1];
  return mediaTypes.get(extension);
};
