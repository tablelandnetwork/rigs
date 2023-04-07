import React, { useContext, useEffect, useMemo, useReducer } from "react";
import take from "lodash/take";
import isEqual from "lodash/isEqual";
import { NftTokenType } from "alchemy-sdk";
import { NFT, alchemy, toNFT } from "../hooks/useNFTs";
import { findNFT, NFTIsh } from "../utils/nfts";
import { isPresent } from "../utils/types";
import { Action, reducer } from "./NFTsContext.reducer";

interface NFTsContextValue {
  nfts: NFT[];
  loadingNfts: NFTIsh[];
  dispatch: React.Dispatch<Action>;
}

const NFTsContext = React.createContext<NFTsContextValue | undefined>(
  undefined
);

export const NFTsContextProvider = ({ children }: React.PropsWithChildren) => {
  const [{ nfts, loadingNfts }, dispatch] = useReducer(reducer, {
    nfts: [],
    loadingNfts: [],
  });

  useEffect(() => {
    let isCancelled = false;

    const tokens = take(loadingNfts, 100).map(({ contract, tokenId }) => {
      return {
        tokenId,
        contractAddress: contract,
        tokenType: NftTokenType.ERC721 as const,
      };
    });

    if (!tokens.length) return;

    alchemy.nft.getNftMetadataBatch(tokens).then((v) => {
      if (isCancelled) return;

      dispatch({
        type: "NFTS_LOADED",
        payload: { query: loadingNfts, result: v.map(toNFT) },
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [loadingNfts, dispatch]);

  const value = useMemo(() => {
    return { nfts, loadingNfts, dispatch };
  }, [nfts, loadingNfts, dispatch]);

  return <NFTsContext.Provider value={value}>{children}</NFTsContext.Provider>;
};

export const useNFTsContext = () => useContext(NFTsContext);

export const useNFTsCached = (
  input?: { contract: string; tokenId: string }[]
) => {
  const ctx = useNFTsContext();

  if (!ctx) throw new Error("useNFTsCached cannot be used outside of context");
  const { nfts, loadingNfts, dispatch } = ctx;

  useEffect(() => {
    if (!input) return;

    dispatch({ type: "LOAD_NFTS", payload: input });
  }, [input, dispatch]);

  if (!input?.length) {
    return { nfts: [] };
  }

  const isLoading = input.some((v) => loadingNfts.some((l) => isEqual(v, l)));
  if (isLoading) {
    return { nfts: undefined };
  }

  const result = input.map((v) => findNFT(v, nfts)).filter(isPresent);

  if (!result.length) return { nfts: [] };
  return { nfts: result };
};
