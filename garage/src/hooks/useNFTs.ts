import { useEffect, useState } from "react";
import { Chain, chain as chains } from "wagmi";
import {
  Network,
  Alchemy,
  NftTokenType,
  Nft,
  NftContract,
  NftExcludeFilters,
  GetNftsForOwnerOptions,
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

export const alchemy = new Alchemy(settings);

export interface NFT {
  type: "ERC721" | "ERC1155" | "UNKNOWN";
  contract: string;
  tokenId: string;
  name?: string;
  imageUrl?: string;
}

const toNFT = (data: Nft): NFT => {
  const { contract, tokenId, title, media } = data;

  return {
    type: contract.tokenType,
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

interface OwnedNFTsFilter {
  contracts?: string[];
}

export const useOwnedNFTs = (
  owner: string | undefined,
  limit = 50,
  after: string = "",
  filter?: OwnedNFTsFilter
) => {
  const [nfts, setNFTs] = useState<NFT[]>();

  useEffect(() => {
    let isCancelled = false;

    if (!owner) return;

    let options: GetNftsForOwnerOptions = {
      pageSize: limit,
      pageKey: after,
      omitMetadata: false,
      excludeFilters: [NftExcludeFilters.SPAM],
    };
    if (filter?.contracts)
      options = { ...options, contractAddresses: filter.contracts };

    alchemy.nft.getNftsForOwner(owner, options).then((v) => {
      if (isCancelled) return;

      setNFTs(v.ownedNfts.map(toNFT));
    });

    return () => {
      isCancelled = true;
    };
  }, [owner, limit, after, filter, setNFTs]);

  // TODO support pagination
  return { nfts };
};

export interface Collection {
  name: string;
  contractAddress: string;
  imageUrl?: string;
}

export const toCollection = (c: NftContract): Collection => {
  const { address, name = "", openSea } = c;

  return { name, contractAddress: address, imageUrl: openSea?.imageUrl };
};

interface NFTCollectionsData {
  isLoading: boolean;
  isError: boolean;
  collections?: Collection[];
}

export const useNFTCollections = (search: string) => {
  const [data, setData] = useState<NFTCollectionsData>({
    isLoading: false,
    isError: false,
  });

  useEffect(() => {
    let isCancelled = false;

    if (!search) {
      setData({ isLoading: false, isError: false });
      return;
    }

    setData((oldData) => {
      return { ...oldData, isLoading: true, isError: false };
    });

    alchemy.nft.searchContractMetadata(search).then((v) => {
      if (isCancelled) return;

      setData({
        isLoading: false,
        isError: false,
        collections: v.map(toCollection),
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [search, setData]);

  return data;
};
