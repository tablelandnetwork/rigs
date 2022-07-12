import { ethers, network, rigsConfig, rigsDeployment } from "hardhat";
import { Wallet, providers, BigNumber, utils } from "ethers";
import { AllowListEntry, buildTree } from "../helpers/allowlist";
import type { TablelandRigs, PaymentSplitter } from "../typechain-types";
import { connect, ConnectOptions, SUPPORTED_CHAINS } from "@tableland/sdk";
import fetch, { Headers, Request, Response } from "node-fetch";

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
  if (
    rigsConfig.tables.tokensTable === "" ||
    rigsConfig.tables.attributesTable === ""
  ) {
    throw Error(`missing table names entries in config`);
  }
  const uriTemplateStr =
    rigsConfig.tables.tablelandHost +
    "/query?mode=list&s=" +
    encodeURIComponent(
      `select json_object('name','#'||id,'external_url','https://tableland.xyz/rigs/'||id,'image',image,'image_alpha',image_alpha,'thumb',thumb,'thumb_alpha',thumb_alpha,'attributes',json_group_array(json_object('display_type',display_type,'trait_type',trait_type,'value',value))) from ${rigsConfig.tables.tokensTable} join ${rigsConfig.tables.attributesTable} on ${rigsConfig.tables.tokensTable}.id=${rigsConfig.tables.attributesTable}.rig_id where id={id} group by id;`
    );
  const uriTemplate = uriTemplateStr.split("{id}");

  // Don't allow multiple deployments per network
  if (rigsDeployment.contractAddress !== "") {
    throw Error(`already deployed to '${network.name}'`);
  }

  // Build merkle trees for allowlist
  const allowlistTree = buildTree(rigsConfig.allowlist);
  const waitlistTree = buildTree(rigsConfig.waitlist);
  console.log("Using merkleroot for allowlist:", allowlistTree.getHexRoot());
  console.log("Using merkleroot for waitlist:", waitlistTree.getHexRoot());

  // Connect to tableland
  const wallet = new Wallet(rigsConfig.tables.tablelandPrivateKey!);
  const provider = new providers.AlchemyProvider(
    SUPPORTED_CHAINS[rigsConfig.tables.tablelandChain],
    rigsConfig.tables.tablelandProvider
  );
  const options: ConnectOptions = {
    chain: rigsConfig.tables.tablelandChain,
    signer: wallet.connect(provider),
  };
  const tbl = await connect(options);

  // Create contract table
  let createRes = await tbl.create(
    "name text, description text, image text, external_link text, seller_fee_basis_points int, fee_recipient text",
    "rigs_contract"
  );
  const contractTable = createRes.name;
  console.log("Contract table created as:", contractTable);

  // Insert contract info
  let runStatement = `insert into ${contractTable} values ('${rigsConfig.name}', '${rigsConfig.description}', '${rigsConfig.image}', '${rigsConfig.externalLink}', ${rigsConfig.sellerFeeBasisPoints}, '${rigsConfig.feeRecipient}');`;
  const writeRes = await tbl.write(runStatement);
  console.log(
    `Inserted contract info with txn ${writeRes.hash}: `,
    rigsConfig.name,
    rigsConfig.description,
    rigsConfig.image,
    rigsConfig.externalLink,
    rigsConfig.sellerFeeBasisPoints,
    rigsConfig.feeRecipient
  );

  // Get contract URI
  const contractURI =
    rigsConfig.tables.tablelandHost +
    "/query?mode=list&s=" +
    encodeURIComponent(
      `select json_object('name',name,'description',description,'image',image,'external_link',external_link,'seller_fee_basis_points',seller_fee_basis_points,'fee_recipient',fee_recipient) from ${contractTable} limit 1;`
    );

  // Create allow list table
  createRes = await tbl.create(
    `address text, freeAllowance int, paidAllowance int, waitlist int`,
    "rigs_allowlist"
  );
  const allowlistTable = createRes.name;
  console.log("Allowlist table created as:", allowlistTable);

  // Insert allow list entries
  async function insertEntries(
    list: [string, AllowListEntry][],
    waitlist: boolean
  ) {
    while (list.length > 0) {
      const entries = list.splice(0, 100);
      runStatement = "";
      for (const [address, entry] of entries) {
        runStatement += `insert into ${allowlistTable} values ('${address}', ${
          entry.freeAllowance
        }, ${entry.paidAllowance}, ${waitlist ? 1 : 0});`;
      }
      const res = await tbl.write(runStatement);

      console.log(
        `Inserted ${entries.length} allowlist entries with txn ${res.hash}`
      );
    }
  }
  await insertEntries(Object.entries(rigsConfig.allowlist), false);
  await insertEntries(Object.entries(rigsConfig.waitlist), true);

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
  const rigs = (await RigsFactory.deploy(
    BigNumber.from(rigsConfig.maxSupply),
    utils.parseEther(rigsConfig.etherPrice),
    rigsConfig.feeRecipient,
    splitter.address,
    allowlistTree.getHexRoot(),
    waitlistTree.getHexRoot()
  )) as TablelandRigs;
  await rigs.deployed();
  console.log("Deployed Rigs:", rigs.address);

  let tx = await rigs.setContractURI(contractURI);
  await tx.wait();
  console.log("Set contract URI:", contractURI);

  tx = await rigs.setURITemplate(uriTemplate);
  await tx.wait();
  console.log("Set URI template:", uriTemplateStr);

  // Warn that addresses need to be saved in config
  console.warn(
    `\nSave 'config.${network.name}.contractAddress: "${rigs.address}"' in the hardhat config!`
  );
  console.warn(
    `Save 'config.${network.name}.royaltyContractAddress: "${splitter.address}"' in the hardhat config!`
  );
  console.warn(
    `Save 'config.${network.name}.contractTable: "${contractTable}"' in the hardhat config!`
  );
  console.warn(
    `Save 'config.${network.name}.allowlistTable: "${allowlistTable}"' in the hardhat config!`
  );

  //

  // Get proof
  // const allowance = rigsConfig.allowlist[account.address];
  // if (allowance === undefined) {
  //   throw Error("no allowance");
  // }
  // const proof = merkletree.getHexProof(
  //   hashEntry(account.address, rigsConfig.allowlist[account.address])
  // );

  // // const tx = await rigs.claim(
  // //   BigNumber.from(allowance),
  // //   BigNumber.from(allowance),
  // //   proof,
  // //   { value: utils.parseEther("0.05"), gasLimit: 10000000 }
  // // );
  // const cost = parseFloat(rigsConfig.etherPrice) * allowance
  // const tx = await rigs.claim(
  //   BigNumber.from(allowance),
  //   BigNumber.from(allowance),
  //   proof,
  //   { value: utils.parseEther(cost.toString()) }
  // );
  // await tx.wait();

  // if (rigsConfig.autoMint > 0) {
  //   const price = (
  //     parseFloat(rigsConfig.etherPrice) * rigsConfig.autoMint
  //   ).toString();
  //   const tx = await rigs.mint(rigsConfig.autoMint, {
  //     value: utils.parseEther(price),
  //   });
  //   await tx.wait();
  // }
  // console.log(`\nMinted ${rigsConfig.autoMint} rigs!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
