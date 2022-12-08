import { NFT } from "../hooks/useNFTs";

type Data = Omit<NFT, "type">

export const findNFT = (needle: Data, haystack: NFT[]) => {
  return haystack.find((v) => {
    return (
      v.tokenId === needle.tokenId &&
      v.contract.toLowerCase() === needle.contract.toLowerCase()
    );
  });
}
