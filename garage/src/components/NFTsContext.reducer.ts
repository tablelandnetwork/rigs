import uniqWith from "lodash/uniqWith";
import isEqual from "lodash/isEqual";
import { NFT } from "~/hooks/useNFTs";
import { findNFT, NFTIsh } from "~/utils/nfts";

interface LoadNFTs {
  payload: NFTIsh[];
  type: "LOAD_NFTS";
}

interface NFTsLoaded {
  payload: { query: NFTIsh[]; result: NFT[] };
  type: "NFTS_LOADED";
}

export type Action = LoadNFTs | NFTsLoaded;

export interface State {
  nfts: NFT[];
  loadingNfts: NFTIsh[];
}

const mergeWithLoad = (state: State, load: NFTIsh[]) => {
  let toLoad = uniqWith(
    load.filter((v) => {
      if (!v.contract || !v.tokenId) return false;

      if (findNFT(v, state.nfts)) return false;

      return true;
    }),
    isEqual
  );

  if (!toLoad.length) return state;

  let newState = { ...state };
  let loadingNfts = [...newState.loadingNfts];

  for (const { contract, tokenId } of toLoad) {
    if (
      !loadingNfts.find((v) => v.contract === contract && v.tokenId === tokenId)
    ) {
      loadingNfts = [...loadingNfts, { contract, tokenId }];
    }
  }

  newState.loadingNfts = loadingNfts;

  return newState;
};

const mergeWithResult = (state: State, query: NFTIsh[], result: NFT[]) => {
  let newState = { ...state };

  if (result.length) {
    let newNfts = [...newState.nfts];
    for (const nft of result) {
      if (!findNFT(nft, newNfts)) {
        newNfts = [...newNfts, nft];
      }
    }

    newState.nfts = newNfts;
  }

  if (query.length) {
    let newLoadingNfts = [...newState.loadingNfts];
    for (const nft of query) {
      const inResult = findNFT(nft, newLoadingNfts);

      newLoadingNfts = newLoadingNfts.filter((v) => v !== inResult);
    }
    newState.loadingNfts = newLoadingNfts;
  }

  return newState;
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "LOAD_NFTS":
      return mergeWithLoad(state, action.payload);
    case "NFTS_LOADED":
      return mergeWithResult(
        state,
        action.payload.query,
        action.payload.result
      );
    default:
      break;
  }

  return state;
};
