import { ethers, network, rigsConfig } from "hardhat";
import { BigNumber, utils } from "ethers";
import type { TablelandRigs, PaymentSplitter } from "../typechain-types";

async function main() {
  console.log(`\nDeploying to '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get URI template
  if (rigsConfig.uriTemplate === undefined || rigsConfig.uriTemplate === "") {
    throw Error(`missing uriTemplate entry for '${network.name}'`);
  }

  // Don't allow multiple deployments per network
  if (rigsConfig.contractAddress !== "") {
    throw Error(`already deployed to '${network.name}'`);
  }

  // Deploy
  const SplitterFactory = await ethers.getContractFactory("PaymentSplitter");
  const splitter = (await SplitterFactory.deploy(
    rigsConfig.royaltyReceivers,
    rigsConfig.royaltyReceiverShares
  )) as PaymentSplitter;
  await splitter.deployed();

  const RigsFactory = await ethers.getContractFactory("TablelandRigs");
  const rigs = (await RigsFactory.deploy(
    BigNumber.from(rigsConfig.maxSupply),
    utils.parseEther(rigsConfig.etherPrice),
    rigsConfig.uriTemplate,
    rigsConfig.beneficiary,
    splitter.address
  )) as TablelandRigs;
  await rigs.deployed();

  // Warn that addresses need to be saved in config
  console.warn(
    `\nSave 'config.${network.name}.contractAddress: "${rigs.address}"' in the hardhat config!`
  );
  console.warn(
    `Save 'config.${network.name}.royaltyContractAddress: "${splitter.address}"' in the hardhat config!`
  );

  if (rigsConfig.autoMint > 0) {
    const price = (
      parseFloat(rigsConfig.etherPrice) * rigsConfig.autoMint
    ).toString();
    const tx = await rigs.mint(rigsConfig.autoMint, {
      value: utils.parseEther(price),
    });
    await tx.wait();
  }
  console.log(`\nMinted ${rigsConfig.autoMint} rigs!`)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
