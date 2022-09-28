import { ethers, BigNumber } from "ethers";
import { connect } from "@tableland/sdk";
import { deployments } from "@tableland/rigs/deployments.js";
import { TablelandRigs__factory } from "@tableland/rigs/typechain-types/factories/contracts/TablelandRigs__factory.js";
const chain = "ethereum";
const contractAddress = deployments[chain].contractAddress;
const contractABI = TablelandRigs__factory.abi;
const alchemyApiKey = "2-splbb2E9wDI3v4pYwMB-TWqHu9Xhe2";
const ipfsGatewayUri = "https://ipfs.io/ipfs/";
async function load({ url }) {
  connect({ chain: "ethereum-goerli" });
  const rigId = url.searchParams.get("rig");
  if (!rigId) {
    throw new Error("invalid rig ID");
  }
  const badges = [
    "TableLand_Badges_Code.png",
    "TableLand_Badges_Education.png",
    "TableLand_Badges_Filecoin.png",
    "TableLand_Badges_NetworkRewards.png",
    "TableLand_Badges_SuccessfulProject.png",
    "TableLand_Badges_Teaching.png"
  ];
  const rigUrl = await getTokenURI(rigId);
  const res = await fetch(rigUrl);
  const metadata = await res.json();
  const httpUri = ipfsGatewayUri + metadata.image.slice(7);
  return {
    imageUrl: httpUri,
    badges
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
export {
  load
};
