import { rigsConfig } from "hardhat";
import { buildTree, countList, getListFromCSVs } from "../helpers/allowlist";
import assert from "assert";

async function main() {
  console.log(`\nGenerating lists...`);

  // Build allow lists
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
