import { network, rigsDeployment, ethers } from "hardhat";
import { Database } from "@tableland/sdk";
// import { TablelandRigs } from "../typechain-types";

const db = new Database();

// Blur API response
type BlurRig = {
  id: string; // Rig tokenId
  isSuspicious: boolean;
  owner: string;
  contractAddress: string;
  tokenId: string;
  imageUrl: string;
  price: string;
  priceUnit: string;
  createdAt: string;
  updatedAt: string;
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

  // Get owner account
  // const [account] = await ethers.getSigners();
  // if (account.provider === undefined) {
  //   throw Error("missing provider");
  // }

  // Get contract address
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsDeployment.contractAddress}'`);

  // Get listings on Blur
  const blurReq = await fetch(
    "https://openblur.p.rapidapi.com/listings?" +
      new URLSearchParams({
        contractAddress: rigsDeployment.contractAddress.toLowerCase(),
        orderBy: "ASC",
        pageSize: "100",
      }),
    {
      headers: {
        "X-RapidAPI-Key": process.env.OPENBLUR_API_KEY!,
        "X-RapidAPI-Host": "openblur.p.rapidapi.com",
      },
    }
  );
  const blurRes = await blurReq.json();
  const blurListed: BlurRig[] = blurRes.items || [];

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
      },
    }
  );
  const lrRes = await lrReq.json();
  const lrListed: LooksRareRig[] = lrRes.data;

  // Check if Rigs are in-flight on each marketplace
  const blurIds = blurListed.map((l) => {
    return parseInt(l.tokenId);
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

  // // Park rigs
  // const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
  //   rigsDeployment.contractAddress
  // ) as TablelandRigs;
  // const tx = await rigs.parkRigAsAdmin([
  //   /* rigs IDs to park here */
  // ]);
  // const receipt = await tx.wait();
  // console.log(`parked rigs with txn '${receipt.transactionHash}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
