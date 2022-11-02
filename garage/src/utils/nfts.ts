import { NFT } from "../hooks/useNFTs";

export const findNFT = (needle: NFT, haystack: NFT[]) => {
  return haystack.find((v) => {
    return (
      v.tokenId === needle.tokenId &&
      v.contract.toLowerCase() === needle.contract.toLowerCase()
    );
  });
}
