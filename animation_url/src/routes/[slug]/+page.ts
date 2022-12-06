import { connect } from "@tableland/sdk";
import { ZDK, ZDKNetwork, ZDKChain } from "@zoralabs/zdk";
import { deployments } from "../../../../ethereum/deployments.js";
import { default as trainer } from "../../assets/trainer.svg";

const isDev =
  import.meta.env.DEV || import.meta.env.VITE_VERCEL_ENV === "preview";

const chain = isDev ? "polygon-mumbai" : "ethereum";
const deployment = deployments[chain];

const ipfsGatewayUri = isDev
  ? "https://nftstorage.link/ipfs/"
  : "https://tableland.mypinata.cloud/ipfs/";

// NOTE: zdk docs say that only mainnet is supported currently. We could be
//       supporting testnet here, but for the time being testnet localnet
//       collections will show the pilot from mainnet.
const networkInfo = {
  network: ZDKNetwork.Ethereum,
  chain: ZDKChain.Mainnet,
};

const API_ENDPOINT = "https://api.zora.co/graphql";
const args = {
  endPoint: API_ENDPOINT,
  networks: [networkInfo],
  apiKey: import.meta.env.VITE_ZORA_API_KEY,
};

const zdk = new ZDK(args);
const tableland = connect({ chain, host: deployment.tablelandHost });

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
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

  const pilot = await getPilot(rigId);

  return {
    imageUrl: httpUri,
    badges: [],
    pilot,
  };
}

const getPilot = async function (rigId, pilotAddress, pilotId): Promise<string> {
  // check if rig is parked first
  const notParked = await tableland.read(
    `SELECT end_time FROM ${deployment.pilotSessionsTable} WHERE rig_id = ${rigId} AND end_time is null;`, {
      output: "objects"
    }
  );

  // parked
  if (!notParked || notParked.length === 0) {
    return "";
  }

  // get the 2 newest sessions so we can decide if the rig is training or flying
  const sessionArr = await tableland.read(
    `SELECT * FROM ${deployment.pilotSessionsTable} WHERE rig_id = ${rigId} ORDER BY start_time desc LIMIT 2;`, {
      output: "objects"
    }
  );

  // If the rig only has one session and end_time is null, it's in training
  if (sessionArr.length === 1 && sessionArr[0].end_time === null) {
    return trainer;
  }

  const currentSession = sessionArr && sessionArr[0];
  // no session means nothing to show because the rig has never been trained
  if (!currentSession) {
    return "";
  }

  // if end_time is greater than or equal to start_time it's parked or never finished training
  if (currentSession.end_time >= currentSession.start_time) {
    return "";
  }

  // If we get here it means the rig is piloted. NOTE: this will only show eth mainnet Pilots
  if (currentSession.pilot_contract && currentSession.pilot_id) {
    const pilotToken = await zdk.token({
      token: {
        address: currentSession.pilot_contract, // "0x6c9343ca5c2ef3a35a83438344bb3cbe3c249f65",
        tokenId: currentSession.pilot_id.toString(), // "903",
      }
    });

    const image = pilotToken?.token?.token?.image?.url;
    return image;
  }

  // fall through case is show nothing
  return "";
};
