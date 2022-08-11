import { ethers, upgrades, network, rigsConfig, rigsDeployment } from "hardhat";
import { Wallet, providers, BigNumber, utils } from "ethers";
import {
  AllowListEntry,
  buildTree,
  countList,
  getListFromCSVs,
} from "../helpers/allowlist";
import type { TablelandRigs, PaymentSplitter } from "../typechain-types";
import {
  connect,
  ConnectOptions,
  Connection,
  SUPPORTED_CHAINS,
} from "@tableland/sdk";
import fetch, { Headers, Request, Response } from "node-fetch";
import { getContractURI, getURITemplate } from "../helpers/uris";
import assert from "assert";

if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = fetch;
  (globalThis as any).Headers = Headers;
  (globalThis as any).Request = Request;
  (globalThis as any).Response = Response;
}

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get URI template
  if (rigsDeployment.tokensTable === "") {
    throw Error(`missing tokens table entry in deployments`);
  }
  const uriTemplate = getURITemplate(
    rigsDeployment.tablelandHost,
    rigsDeployment.tokensTable,
    rigsDeployment.attributesTable
  );

  // Don't allow multiple deployments per network
  if (rigsDeployment.contractAddress !== "") {
    throw Error(`already deployed to '${network.name}'`);
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
  let tbl: Connection;
  if (
    rigsDeployment.contractTable === "" ||
    rigsDeployment.allowlistTable === ""
  ) {
    const wallet = new Wallet(rigsConfig.tables.tablelandPrivateKey!);
    const provider = new providers.AlchemyProvider(
      SUPPORTED_CHAINS[rigsDeployment.tablelandChain],
      rigsConfig.tables.tablelandProvider
    );
    const options: ConnectOptions = {
      chain: rigsDeployment.tablelandChain,
      signer: wallet.connect(provider),
    };
    tbl = await connect(options);
  }

  // Create contract table
  let contractTable: string;
  if (rigsDeployment.contractTable === "") {
    const createRes = await tbl!.create(
      "name text, description text, image text, external_link text, seller_fee_basis_points int, fee_recipient text",
      "rigs_contract"
    );
    contractTable = createRes.name!;
    console.log("Contract table created as:", contractTable);

    // Insert contract info
    const runStatement = `insert into ${contractTable} values ('${rigsConfig.name}', '${rigsConfig.description}', '${rigsConfig.image}', '${rigsConfig.externalLink}', ${rigsConfig.sellerFeeBasisPoints}, '${rigsConfig.feeRecipient}');`;
    const writeRes = await tbl!.write(runStatement);
    console.log(
      `Inserted contract info with txn '${writeRes.hash}': `,
      rigsConfig.name,
      rigsConfig.description,
      rigsConfig.image,
      rigsConfig.externalLink,
      rigsConfig.sellerFeeBasisPoints,
      rigsConfig.feeRecipient
    );
  } else {
    contractTable = rigsDeployment.contractTable;
  }

  // Get contract URI
  const contractURI = getContractURI(
    rigsDeployment.tablelandHost,
    contractTable
  );

  // Create allow list table
  let allowlistTable: string;
  if (rigsDeployment.allowlistTable === "") {
    const createRes = await tbl!.create(
      `address text, freeAllowance int, paidAllowance int, waitlist int`,
      "rigs_allowlist"
    );
    allowlistTable = createRes.name!;
    console.log("Allowlist table created as:", allowlistTable);

    // Insert allow list entries
    async function insertEntries(
      list: [string, AllowListEntry][],
      waitlist: boolean
    ) {
      while (list.length > 0) {
        const entries = list.splice(0, 50);
        let runStatement = "";
        for (const [address, entry] of entries) {
          runStatement += `insert into ${allowlistTable} values ('${address}', ${
            entry.freeAllowance
          }, ${entry.paidAllowance}, ${waitlist ? 1 : 0});`;
        }
        const res = await tbl.write(runStatement);

        console.log(
          `Inserted ${entries.length} allowlist entries with txn '${res.hash}'`
        );
      }
    }
    await insertEntries(Object.entries(allowlist), false);
    await insertEntries(Object.entries(waitlist), true);
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

  let tx = await rigs.setContractURI(contractURI);
  await tx.wait();
  console.log("Set contract URI:", contractURI);

  tx = await rigs.setURITemplate(uriTemplate);
  await tx.wait();
  console.log("Set URI template:", uriTemplate.join("{id}"));

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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
