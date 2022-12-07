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
  // Get the sessions where end_time is null, there should only ever be one of these
  const sessions = await tableland.read(
    `SELECT * FROM ${deployment.pilotSessionsTable} WHERE rig_id = ${rigId} AND end_time is null;`, {
      output: "objects"
    }
  );

  if (!(sessions && sessions.length > 0)) {
    // no session without an end_time, show nothing
    return "";
  }

  // there's a session without an end_time, show a pilot
  const session = sessions[0];

  // show pilot
  if (session.pilot_contract && session.pilot_id) {
    const pilotToken = await zdk.token({
      token: {
        address: session.pilot_contract, // "0x6c9343ca5c2ef3a35a83438344bb3cbe3c249f65",
        tokenId: session.pilot_id.toString(), // "903",
      }
    });

    const image = pilotToken?.token?.token?.image?.url;
    return image;
  }

  // else show trainer
  return trainer;
};
