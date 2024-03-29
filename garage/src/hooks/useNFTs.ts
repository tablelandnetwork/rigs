import { useEffect, useState } from "react";
import { Chain } from "wagmi";
import * as chains from "wagmi/chains";
import {
  Network,
  Alchemy,
  NftTokenType,
  Nft,
  NftContract,
  NftFilters,
  GetNftsForOwnerOptions,
} from "alchemy-sdk";
import { useQuery } from "@tanstack/react-query";
import { mainChain } from "~/env";

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
    case chains.hardhat:
      return Network.ETH_MAINNET;
    default:
      throw new Error(`wagmiChainToNetwork unsupported mainChain, ${c}`);
  }
};

const settings = {
  apiKey: import.meta.env.VITE_ALCHEMY_ID,
  network: wagmiChainToNetwork(mainChain),
};

export const alchemy = new Alchemy(settings);

enum NFTType {
  ERC721 = "ERC721",
  ERC1155 = "ERC1155",
  UNKNOWN = "UNKNOWN",
}

export interface NFT {
  type: NFTType;
  contract: string;
  tokenId: string;
  name?: string;
  imageUrl?: string;
  highResImageUrl?: string;
  imageData?: string;
}

const toNFTType = (t: Nft["tokenType"]): NFTType => {
  if (t === "ERC721") return NFTType.ERC721;
  if (t === "ERC1155") return NFTType.ERC1155;

  return NFTType.UNKNOWN;
};

export const toNFT = (data: Nft): NFT => {
  const { contract, tokenId, title, media, rawMetadata } = data;

  const imageUrl = media[0]?.thumbnail || media[0]?.gateway || media[0]?.raw;
  const highResImageUrl = media[0]?.gateway || media[0]?.raw;
  const imageData = rawMetadata?.image_data || rawMetadata?.svg_image_data;

  const fallbackName = (contract.name + " " + tokenId).trim();

  return {
    type: toNFTType(contract.tokenType),
    contract: contract.address,
    tokenId,
    name: title || fallbackName,
    imageUrl,
    highResImageUrl,
    imageData,
  };
};

export const useNFTs = (input?: { contract: string; tokenId: string }[]) => {
  const [nfts, setNFTs] = useState<NFT[]>();

  useEffect(() => {
    let isCancelled = false;

    if (!input) return;

    input = input.filter(({ contract }) => contract);

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

const fetchNftsForOwner = async (
  owner: string,
  pageSize: number,
  pageKey: string,
  filter?: OwnedNFTsFilter
) => {
  let options: GetNftsForOwnerOptions = {
    pageSize,
    pageKey,
    omitMetadata: false,
    excludeFilters: [NftFilters.SPAM],
  };
  if (filter?.contracts) {
    options = { ...options, contractAddresses: filter.contracts };
  }

  const res = await alchemy.nft.getNftsForOwner(owner, options);

  return {
    nfts: res.ownedNfts.map(toNFT),
    pageKey: res.pageKey,
    hasMore: res.ownedNfts.length === pageSize,
  };
};

const getFilterKey = (filter?: OwnedNFTsFilter): string => {
  return filter?.contracts?.join(":") ?? "";
};

export const useOwnedNFTs = (
  owner: string | undefined,
  limit = 50,
  pageKey: string = "",
  filter?: OwnedNFTsFilter
) => {
  return useQuery(
    [`owned-nfts-${owner}-${getFilterKey(filter)}`, pageKey],
    () =>
      owner
        ? fetchNftsForOwner(owner, limit, pageKey, filter)
        : { nfts: [], hasMore: false, pageKey: "" },
    { keepPreviousData: false, staleTime: 60_000 }
  );
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

export const useNFTCollectionSearch = (search: string) => {
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

export const useNFTCollections = (contracts?: string[]) => {
  const [data, setData] = useState<NFTCollectionsData>({
    isLoading: false,
    isError: false,
  });

  useEffect(() => {
    let isCancelled = false;

    if (!contracts?.length) {
      setData({ isLoading: false, isError: false });
      return;
    }

    setData((oldData) => {
      return { ...oldData, isLoading: true, isError: false };
    });

    alchemy.nft.getContractMetadataBatch(contracts).then((data) => {
      if (isCancelled) return;

      setData({
        isLoading: false,
        isError: false,
        collections: data.map(toCollection),
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [contracts, setData]);

  return data;
};
