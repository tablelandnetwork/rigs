import { network, rigsDeployment } from "hardhat";
import { Database } from "@tableland/sdk";

const db = new Database();

// Type Simplehash Blur rigs
type SimplehashBlurRig = {
  id: string;
  permalink: string;
  bundle_item_number: string | null;
  listing_timestamp: string;
  expiration_timestamp: string | null;
  seller_address: string;
  auction_type: string | null;
  quantity: number;
  quantity_remaining: number;
  price: number;
  marketplace_id: string;
  order_hash: string | null;
  collection_id: string;
  nft_id: string; // Token ID as suffix: `ethereum.0x8eaa9ae1ac89b1c8c8a8104d08c045f78aadb42d.2359`
  payment_token: {
    payment_token_id: string;
    name: string;
    symbol: string;
    address: string | null;
    decimals: number;
  };
  is_private: boolean;
};

// OpenSea API response
type OsRig = {
  order_hash: string;
  chain: string;
  type: string;
  price: {
    current: {
      currency: string;
      decimals: number;
      value: string;
    };
  };
  protocol_data: {
    parameters: {
      offerer: string;
      offer: Array<{
        itemType: number;
        token: string;
        identifierOrCriteria: string; // Rig tokenId
        startAmount: string;
        endAmount: string;
      }>;
      consideration: Array<{
        itemType: number;
        token: string;
        identifierOrCriteria: string;
        startAmount: string;
        endAmount: string;
        recipient: string;
      }>;
      startTime: string;
      endTime: string;
      orderType: number;
      zone: string;
      zoneHash: string;
      salt: string;
      conduitKey: string;
      totalOrginalConsiderationItems: number;
      counter: number;
    };
    signature: string | null;
  };
  protocol_address: string;
};

// LooksRare API
type LooksRareRig = {
  id: string;
  hash: string;
  quoteType: number;
  globalNonce: string;
  subsetNonce: string;
  orderNonce: string;
  collection: string;
  currency: string;
  signer: string;
  strategyId: number;
  collectionType: number;
  startTime: number;
  endTime: number;
  price: string;
  additionalParameters: string;
  signature: string;
  createdAt: string;
  merkleRoot: null;
  merkleProof: null;
  amounts: Array<string>;
  itemIds: Array<string>; // Rig tokenId
  status: string;
};

async function getInFlight(rigIds: number[]): Promise<number[]> {
  // Get the sessions where end_time is null, there should only ever be one of these
  const res = await db
    .prepare(
      `SELECT rig_id FROM ${
        rigsDeployment.pilotSessionsTable
      } WHERE rig_id in (${rigIds.join(",")}) AND end_time is null;`
    )
    .all<{ rig_id: number }>();
  const ids: number[] = [];
  (res && res.results ? res.results : []).forEach((i) => {
    ids.push(i.rig_id);
  });
  return ids;
}

async function main() {
  console.log(
    `\nGetting listed rigs that are in-flight on '${network.name}'...`
  );

  // Get contract address
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsDeployment.contractAddress}'`);

  // Get listings on Blur
  const blurReq = await fetch(
    `https://api.simplehash.com/api/v0/nfts/listings/ethereum/${rigsDeployment.contractAddress}` +
      new URLSearchParams({
        marketplaces: "blur",
        limit: "50", // Note: max is 50 listings; we can assume this won't be exceeded on a single marketplace
      }),
    {
      headers: {
        "X-API-KEY": process.env.OPENBLUR_API_KEY!,
      },
    }
  );
  const blurRes = await blurReq.json();
  const blurListed: SimplehashBlurRig[] = blurRes.listings || [];

  // Get listings on OpenSea
  const osSlug = "tableland-rigs"; // Must query by OS slug, not contract address
  const osReq = await fetch(
    `https://api.opensea.io/v2/listings/collection/${osSlug}/all`,
    {
      headers: {
        accept: "application/json",
        "X-API-KEY": process.env.OPENSEA_API_KEY!,
      },
    }
  );
  const osRes = await osReq.json();
  const osListed: OsRig[] = osRes.listings;

  // Get listings on LooksRare
  const lrReq = await fetch(
    `https://api.looksrare.org/api/v2/orders?quoteType=1&collection=${rigsDeployment.contractAddress}&status=VALID`,
    {
      headers: {
        accept: "application/json",
        "X-Looks-Api-Key": process.env.LOOKSRARE_API_KEY!,
      },
    }
  );
  const lrRes = await lrReq.json();
  const lrListed: LooksRareRig[] = lrRes.data;

  // Check if Rigs are in-flight on each marketplace
  const blurIds = blurListed.map((l) => {
    // Parse tokenId from nft_id (e.g. `2359` from `ethereum.<contract>.2359`)
    const tokenId = l.nft_id.split(".")[2];
    return parseInt(tokenId);
  });
  const osIds =
    osListed.map((l) => {
      return parseInt(l.protocol_data.parameters.offer[0].identifierOrCriteria);
    }) || [];
  const lrIds =
    lrListed.map((l) => {
      return parseInt(l.itemIds[0]);
    }) || [];
  const blurToPark = await getInFlight(blurIds);
  const osToPark = await getInFlight(osIds);
  const lrToPark = await getInFlight(lrIds);
  console.log(
    `----\nForce park Rigs:\n`,
    `Blur: ${blurToPark.length > 0 ? blurToPark.join(",") : "none"}\n`,
    `OpenSea: ${osToPark.length > 0 ? osToPark.join(",") : "none"}\n`,
    `LooksRare: ${lrToPark.length > 0 ? lrToPark.join(",") : "none"}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
