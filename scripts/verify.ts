import { run, network, rigsConfig, rigsDeployment } from "hardhat";
import { BigNumber, utils } from "ethers";
import { buildTree, getListFromCSVs } from "../helpers/allowlist";

async function main() {
  console.log(`\nVerifying on '${network.name}'...`);

  // Ensure deployments
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  if (rigsDeployment.royaltyContractAddress === "") {
    throw Error(`no royaltyContractAddress entry for '${network.name}'`);
  }

  // Build merkle trees for allowlist
  const allowlist = await getListFromCSVs(rigsConfig.allowlistFiles, false);
  const allowlistTree = buildTree(allowlist);
  const waitlist = await getListFromCSVs(rigsConfig.waitlistFiles, true);
  const waitlistTree = buildTree(waitlist);

  // Verify royalties contract
  await run("verify:verify", {
    address: rigsDeployment.royaltyContractAddress,
    constructorArguments: [
      rigsConfig.royaltyReceivers,
      rigsConfig.royaltyReceiverShares,
    ],
  });

  // Verify rigs
  await run("verify:verify", {
    address: rigsDeployment.contractAddress,
    constructorArguments: [
      BigNumber.from(rigsConfig.maxSupply),
      utils.parseEther(rigsConfig.etherPrice),
      rigsConfig.feeRecipient,
      rigsDeployment.royaltyContractAddress,
      allowlistTree.getHexRoot(),
      waitlistTree.getHexRoot(),
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
