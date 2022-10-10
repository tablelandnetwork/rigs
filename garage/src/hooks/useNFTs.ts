import { useEffect, useState } from "react";
import { useZDK } from "./useZDK";
import { ZDK } from "@zoralabs/zdk";

type TokensQuery = Awaited<ReturnType<ZDK["tokens"]>>;

type Unpacked<T> = T extends (infer U)[] ? U : T;

type TokensQueryNode = Unpacked<TokensQuery["tokens"]["nodes"]>;

export interface NFT {
  contract: string;
  tokenId: string;
  name?: string;
  imageUrl?: string;
}

const queryNodeToNFT = (node: TokensQueryNode): NFT => {
  const { tokenId, collectionAddress } = node.token;
  const tokenName = node?.token.name;
  const fallbackName = node
    ? `${node?.token?.tokenContract?.name} #${node?.token?.tokenId}`
    : undefined;
  const media = node?.token.image?.mediaEncoding as { thumbnail: string };
  const imageUrl = media?.thumbnail;

  return {
    contract: collectionAddress,
    tokenId,
    name: tokenName || fallbackName,
    imageUrl,
  };
};

export const useNFTs = (input: { contract: string; tokenId: string }[]) => {
  const { zdk } = useZDK();

  const [nfts, setNFTs] = useState<NFT[]>();

  useEffect(() => {
    let isCancelled = false;
    if (input.length) {
      const tokens = input.map(({ contract, tokenId }) => ({
        address: contract,
        tokenId,
      }));
      zdk.tokens({ where: { tokens } }).then((v) => {
        if (isCancelled) return;

        setNFTs(v.tokens.nodes.map(queryNodeToNFT));
      });
    } else {
      setNFTs([]);
    }

    return () => {
      isCancelled = true;
    };
  }, [input, setNFTs, zdk]);

  return { nfts };
};
