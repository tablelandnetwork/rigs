export interface NFTIsh {
  contract: string;
  tokenId: string;
}

export const findNFT = <T extends NFTIsh>(needle: NFTIsh, haystack: T[]) => {
  return haystack.find((v) => {
    return (
      v.tokenId === needle.tokenId &&
      v.contract.toLowerCase() === needle.contract.toLowerCase()
    );
  });
};
