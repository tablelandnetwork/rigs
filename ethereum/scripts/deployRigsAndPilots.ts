import {
  ethers,
  upgrades,
  network,
  rigsConfig,
  rigsDeployment,
  mainnet,
} from "hardhat";
import { Wallet, providers, BigNumber, utils } from "ethers";
import {
  AllowListEntry,
  buildTree,
  countList,
  getListFromCSVs,
} from "../helpers/allowlist";
import type {
  TablelandRigs,
  PaymentSplitter,
  TablelandRigPilots,
} from "../typechain-types";
import { Database, Statement } from "@tableland/sdk";
import { getContractURI } from "../helpers/uris";
import assert from "assert";

async function main() {
  console.log(`\nDeploying rigs to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Ensure we can build URI template
  if (rigsDeployment.rigsTable === "") {
    throw Error(`missing rigs table entry in deployments`);
  }
  if (rigsDeployment.attributesTable === "") {
    throw Error(`missing attributes table entry in deployments`);
  }
  if (rigsDeployment.lookupsTable === "") {
    throw Error(`missing lookups table entry in deployments`);
  }
  if (rigsDeployment.dealsTable === "") {
    throw Error(`missing deals table entry in deployments`);
  }

  // Don't allow multiple deployments per network
  if (rigsDeployment.contractAddress !== "") {
    throw Error(`already deployed to '${network.name}'`);
  }
  if (rigsDeployment.pilotsAddress !== "") {
    throw Error(`already deployed to '${network.name}'`);
  }
  if (rigsDeployment.pilotSessionsTable !== "") {
    throw Error(`pilot sessions table already exists on '${network.name}'`);
  }

  // Build merkle trees for allowlist
  const allowlist = await getListFromCSVs(rigsConfig.allowlistFiles);
  const allowlistTree = buildTree(allowlist);
  const allowlistAllowances = countList(allowlist);
  const waitlist = await getListFromCSVs(rigsConfig.waitlistFiles);
  const waitlistTree = buildTree(waitlist);
  const waitlistAllowances = countList(waitlist);

  console.log(
    `Allowlist has ${allowlistTree.getLeafCount()} entries and ${allowlistAllowances} total allowances with root:`,
    allowlistTree.getHexRoot()
  );
  console.log(
    `Waitlist has ${waitlistTree.getLeafCount()} entries and ${waitlistAllowances} total allowances with root:`,
    waitlistTree.getHexRoot()
  );

  // Ensure we have correct allowances
  assert(
    allowlistAllowances === rigsConfig.maxSupply,
    `allowlist total allowances does not equal max supply ${rigsConfig.maxSupply}`
  );
  assert(
    waitlistAllowances === rigsConfig.waitlistSize,
    `waitlist total allowances does not equal waitlist size ${rigsConfig.waitlistSize}`
  );

  // Connect to tableland
  let tbl: Database | undefined;
  if (
    rigsDeployment.contractTable === "" ||
    rigsDeployment.allowlistTable === ""
  ) {
    const privateKey = mainnet
      ? rigsConfig.tables.mainnet.tablelandPrivateKey
      : rigsConfig.tables.testnet.tablelandPrivateKey;
    if (!privateKey) {
      throw Error("missing Tableland private key");
    }
    const alchemyKey = mainnet
      ? rigsConfig.tables.mainnet.tablelandAlchemyKey
      : rigsConfig.tables.testnet.tablelandAlchemyKey;
    if (!alchemyKey) {
      throw Error("missing Tableland Alchemy API key");
    }
    const wallet = new Wallet(privateKey);
    const provider = new providers.AlchemyProvider(
      rigsDeployment.tablelandChain,
      alchemyKey
    );
    tbl = new Database({ signer: wallet.connect(provider), autoWait: true });
  }

  // Create allow list table
  let allowlistTable: string;
  if (tbl && rigsDeployment.allowlistTable === "") {
    const { meta } = await tbl
      .prepare(
        "create table rigs_allowlist (address text, freeAllowance int, paidAllowance int, waitlist int)"
      )
      .run();
    if (!meta.txn) {
      throw new Error("no txn found in metadata");
    }
    allowlistTable = meta.txn.name;
    console.log("Allowlist table created as:", allowlistTable);

    // Insert allow list entries
    async function insertEntries(
      tbl: Database,
      list: [string, AllowListEntry][],
      waitlist: boolean
    ) {
      const stmt = tbl.prepare(
        `insert into ${allowlistTable} values (?, ?, ?, ?);`
      );
      while (list.length > 0) {
        const entries = list.splice(0, 50);
        const runStatements: Statement[] = [];
        for (const [address, entry] of entries) {
          runStatements.push(
            stmt.bind(
              address,
              entry.freeAllowance,
              entry.paidAllowance,
              waitlist ? 1 : 0
            )
          );
        }
        const [res] = await tbl.batch(runStatements);

        console.log(
          `Inserted ${entries.length} allowlist entries with txn '${res.meta.txn?.transactionHash}'`
        );
      }
    }
    await insertEntries(tbl, Object.entries(allowlist), false);
    await insertEntries(tbl, Object.entries(waitlist), true);
  } else {
    allowlistTable = rigsDeployment.allowlistTable;
  }

  // Deploy a PaymentSplitter for rewards
  const SplitterFactory = await ethers.getContractFactory("PaymentSplitter");
  const splitter = (await SplitterFactory.deploy(
    rigsConfig.royaltyReceivers,
    rigsConfig.royaltyReceiverShares
  )) as PaymentSplitter;
  await splitter.deployed();
  console.log("Deployed PaymentSplitter:", splitter.address);

  // Create contract table
  let contractTable: string;
  if (tbl && rigsDeployment.contractTable === "") {
    const { meta } = await tbl
      .prepare(
        "create table rigs_contract (name text, description text, image text, external_link text, seller_fee_basis_points int, fee_recipient text)"
      )
      .run();
    if (!meta.txn) {
      throw new Error("no txn found on metadata");
    }
    contractTable = meta.txn.name;
    console.log("Contract table created as:", contractTable);

    // Insert contract info
    const { meta: insertMeta } = await tbl
      .prepare(`insert into ${contractTable} values (?, ?, ?, ?, ?, ?);`)
      .bind(
        rigsConfig.name,
        rigsConfig.description,
        rigsConfig.image,
        rigsConfig.externalLink,
        rigsConfig.sellerFeeBasisPoints,
        splitter.address
      )
      .run();
    console.log(
      `Inserted contract info with txn '${insertMeta.txn?.transactionHash}': `,
      rigsConfig.name,
      rigsConfig.description,
      rigsConfig.image,
      rigsConfig.externalLink,
      rigsConfig.sellerFeeBasisPoints,
      splitter.address
    );
  } else {
    contractTable = rigsDeployment.contractTable;
  }

  // Deploy Rigs
  const RigsFactory = await ethers.getContractFactory("TablelandRigs");
  const rigs = await (
    (await upgrades.deployProxy(
      RigsFactory,
      [
        BigNumber.from(rigsConfig.maxSupply),
        utils.parseEther(rigsConfig.etherPrice),
        rigsConfig.feeRecipient,
        splitter.address,
        allowlistTree.getHexRoot(),
        waitlistTree.getHexRoot(),
      ],
      {
        kind: "uups",
      }
    )) as TablelandRigs
  ).deployed();
  console.log("Deployed Rigs:", rigs.address);

  // Set contract URI
  const contractURI = getContractURI(
    rigsDeployment.tablelandHost,
    contractTable
  );
  const tx = await rigs.setContractURI(contractURI);
  await tx.wait();
  console.log("Set contract URI:", contractURI);

  // Deploy Pilots
  const RigPilotsFactory = await ethers.getContractFactory(
    "TablelandRigPilots"
  );
  const pilots = await (
    (await upgrades.deployProxy(RigPilotsFactory, [rigs.address], {
      kind: "uups",
    })) as TablelandRigPilots
  ).deployed();
  console.log("Deployed Pilots:", pilots.address);
  const pilotSessionsTable = await pilots.pilotSessionsTable();
  console.log("Pilot sessions table:", pilotSessionsTable);

  // Warn that addresses need to be saved in deployments file
  console.warn(
    `\nSave 'deployments.${network.name}.contractAddress: "${rigs.address}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.royaltyContractAddress: "${splitter.address}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.contractTable: "${contractTable}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.allowlistTable: "${allowlistTable}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.pilotsAddress: "${pilots.address}"' in deployments.ts!`
  );
  console.warn(
    `Save 'deployments.${network.name}.pilotSessionsTable: "${pilotSessionsTable}"' in deployments.ts!`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
