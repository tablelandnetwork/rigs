import { ethers, network, rigsConfig, rigsDeployment } from "hardhat";
import { TablelandRigs } from "../typechain-types";

async function main() {
  console.log(`\nSetting mint phase on '${network.name}'...`);

  // Get owner account
  const [account] = await ethers.getSigners();
  if (account.provider === undefined) {
    throw Error("missing provider");
  }

  // Get contract address
  if (rigsDeployment.contractAddress === "") {
    throw Error(`no contractAddress entry for '${network.name}'`);
  }
  console.log(`Using address '${rigsDeployment.contractAddress}'`);

  let mintPhase: 0 | 1 | 2 | 3;
  switch (rigsConfig.mintPhase) {
    case "closed":
      mintPhase = 0;
      break;
    case "allowlist":
      mintPhase = 1;
      break;
    case "waitlist":
      mintPhase = 2;
      break;
    case "public":
      mintPhase = 3;
      break;
    default:
      throw Error("invalid mint phase");
  }

  // Update mint phase
  const rigs = (await ethers.getContractFactory("TablelandRigs")).attach(
    rigsDeployment.contractAddress
  ) as TablelandRigs;
  const tx = await rigs.setMintPhase(mintPhase);
  const receipt = await tx.wait();
  console.log(
    `mint phase set to '${rigsConfig.mintPhase}' with txn '${receipt.transactionHash}'`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
