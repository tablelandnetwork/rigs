import { useEffect, useState } from "react";
import { Chain, chain as chains } from "wagmi";
import {
  Network,
  Alchemy,
  NftTokenType,
  Nft,
} from "alchemy-sdk";
import { chain, deployment } from "../env";

const wagmiChainToNetwork = (c: Chain): Network => {
  switch (c) {
    case chains.mainnet:
      return Network.ETH_MAINNET;
    case chains.goerli:
      return Network.ETH_GOERLI;
    case chains.polygon:
      return Network.MATIC_MAINNET;
    case chains.polygonMumbai:
      return Network.MATIC_MUMBAI;
    default:
      throw new Error(`wagmiChainToNetwork unsupported chain, ${c}`);
  }
};

const settings = {
  apiKey: import.meta.env.VITE_ALCHEMY_ID,
  network: wagmiChainToNetwork(chain),
};

const alchemy = new Alchemy(settings);

export interface NFT {
  contract: string;
  tokenId: string;
  name?: string;
  imageUrl?: string;
}

const toNFT = (data: Nft): NFT => {
  const { contract, tokenId, title, media } = data;

  return {
    contract: contract.address,
    tokenId,
    name: title,
    imageUrl: media.length ? media[0].gateway : undefined,
  };
};

export const useNFTs = (input?: { contract: string; tokenId: string }[]) => {
  const [nfts, setNFTs] = useState<NFT[]>();

  useEffect(() => {
    let isCancelled = false;

    if (!input) return;

    if (input.length) {
      const tokens = input.map(({ contract, tokenId }) => ({
        contractAddress: contract,
        tokenId,
        tokenType: NftTokenType.ERC721 as const,
      }));
      alchemy.nft.getNftMetadataBatch(tokens).then((v) => {
        if (isCancelled) return;

        setNFTs(v.map(toNFT));
      });
    } else {
      setNFTs([]);
    }

    return () => {
      isCancelled = true;
    };
  }, [input, setNFTs]);

  return { nfts };
};
