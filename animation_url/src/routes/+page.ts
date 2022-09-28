import { ethers, BigNumber } from "ethers";
import { connect } from "@tableland/sdk";
import { deployments } from "@tableland/rigs/deployments.js";
import { TablelandRigs__factory } from "@tableland/rigs/typechain-types/factories/contracts/TablelandRigs__factory.js";

const chain = "ethereum";
const contractAddress = deployments[chain].contractAddress;
const contractABI = TablelandRigs__factory.abi;
const alchemyApiKey = "2-splbb2E9wDI3v4pYwMB-TWqHu9Xhe2";

const rigBadgesTableName = "rig_badges_5_todo";
const rigPilotsTableName = "rig_pilots_5_todo";
const ipfsGatewayUri = "https://ipfs.io/ipfs/";

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
  const tableland = connect({ chain: "ethereum-goerli" });

  const rigId = url.searchParams.get("rig");

  if (!rigId) {
    // the client is asking for an invalid url
    // TODO: should be show a placeholder?
    throw new Error("invalid rig ID");
  }

  /*await tableland.read(
    `SELECT * FROM ${rigBadgesTableName} WHERE rig_id = ${rigId};`,
    { output: "objects" }
  );*/
  // TODO: get the badges via tableland
  const badges = [
    "TableLand_Badges_Code.png",
    "TableLand_Badges_Education.png",
    "TableLand_Badges_Filecoin.png",
    "TableLand_Badges_NetworkRewards.png",
    "TableLand_Badges_SuccessfulProject.png",
    "TableLand_Badges_Teaching.png"
  ];

  /*await tableland.read(
    `SELECT * FROM ${rigPilotsTableName} WHERE rig_id = ${rigId};`,
    { output: "objects" }
  );
  */
  const pilot = "moonbird_pilot.png";

  const rigUrl = await getTokenURI(rigId);

  const res = await fetch(rigUrl);
  const metadata = await res.json();

  const httpUri = ipfsGatewayUri + metadata.image.slice(7);

  return {
    imageUrl: httpUri,
    badges,
    pilot
  };
}

const getTokenURI = async (tokenId) => {
  try {
    const provider = new ethers.providers.AlchemyProvider("homestead", alchemyApiKey);
    const contractInstance = new ethers.Contract(contractAddress, contractABI, provider);

    return await contractInstance.tokenURI(BigNumber.from(tokenId));
  } catch (err) {
    throw err;
  }
};
