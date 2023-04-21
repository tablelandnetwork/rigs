import { network, rigsDeployment } from "hardhat";
import { Database } from "@tableland/sdk";
// import { TablelandRigs } from "../typechain-types";

const db = new Database();

type BlurRig = {
  id: string;
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

  // Get listed on Blur
  const blurReq = await fetch(
    "https://openblur.p.rapidapi.com/listings?" +
      new URLSearchParams({
        contractAddress: "0x8eaa9ae1ac89b1c8c8a8104d08c045f78aadb42d",
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

  // Check if each is in-flight
  const ids = blurListed.map((l) => {
    return parseInt(l.tokenId);
  });
  const toPark = await getInFlight(ids);
  console.log(`Park rigs: ${toPark.length > 0 ? toPark.join(",") : "none"}`);

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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
