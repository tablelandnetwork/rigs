import { useEffect, useState } from "react";
import { useZDK } from "./useZDK";
import { ZDK } from "@zoralabs/zdk";

type TokensQuery = Awaited<ReturnType<ZDK["tokens"]>>;

type Unpacked<T> = T extends (infer U)[] ? U : T;

export type NFT = Unpacked<TokensQuery["tokens"]["nodes"]>;

export const useNFTs = (input: { contract: string; tokenId: string }[]) => {
  const { zdk } = useZDK();

  const [nfts, setNFTs] = useState<NFT[]>();

  useEffect(() => {
    console.log("useNFTs effect", { input, zdk });
    let isCancelled = false;
    if (input.length) {
      const tokens = input.map(({ contract, tokenId }) => ({
        address: contract,
        tokenId,
      }));
      zdk.tokens({ where: { tokens } }).then((v) => {
        if (isCancelled) return;

        setNFTs(v.tokens.nodes);
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
