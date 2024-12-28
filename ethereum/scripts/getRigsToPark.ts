import { network, rigsDeployment } from "hardhat";
import { Database } from "@tableland/sdk";

const db = new Database();

type Rig = {
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

type Res = {
  next_cursor: string | null;
  next: string | null;
  previous: string | null;
  listings: Rig[];
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

async function getListedRigs(nextCursor?: string): Promise<Res> {
  const params = new URLSearchParams({
    limit: "50",
  });
  if (nextCursor) {
    params.append("cursor", nextCursor);
  }
  const req = await fetch(
    `https://api.simplehash.com/api/v0/nfts/listings/ethereum/${rigsDeployment.contractAddress}?` +
      params,
    {
      headers: {
        accept: "application/json",
        "X-API-KEY": process.env.SIMPLEHASH_API_KEY!,
      },
    }
  );
  const res: Res = await req.json();
  return res;
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

  let listed: Rig[] = [];
  let nextCursor: string | null = null;
  do {
    let res: Res;
    if (!nextCursor) {
      res = await getListedRigs();
    } else {
      res = await getListedRigs(nextCursor);
    }
    listed = [...listed, ...(res.listings || [])];
    nextCursor = res.next_cursor;
  } while (nextCursor);

  // Check if Rigs are in-flight
  const ids = listed.map((l) => {
    // Parse tokenId from nft_id (e.g. `2359` from `ethereum.<contract>.2359`)
    const tokenId = l.nft_id.split(".")[2];
    return parseInt(tokenId);
  });
  const toPark = await getInFlight(ids);
  console.log(
    `----\nForce park Rigs:\n`,
    `IDs: ${toPark.length > 0 ? toPark.join(",") : "none"}\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
