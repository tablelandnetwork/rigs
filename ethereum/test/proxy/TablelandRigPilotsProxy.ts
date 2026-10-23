import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { artifacts, ethers, network, upgrades } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import type { TablelandRigPilots } from "../../typechain-types";

chai.use(chaiAsPromised);
const expect = chai.expect;

const LOCAL_TABLELAND_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// The registry address used by `TablelandDeployments` on the Hardhat network.
// It is also the address of the deployer's second deployment, so install a
// stand-in registry there and move the deployer past that nonce.
async function useLocalTablelandMock(deployer: SignerWithAddress) {
  const { deployedBytecode } = await artifacts.readArtifact(
    "TablelandTablesMock"
  );
  await network.provider.send("hardhat_setCode", [
    LOCAL_TABLELAND_ADDRESS,
    deployedBytecode,
  ]);
  if ((await deployer.getTransactionCount()) < 2) {
    await network.provider.send("hardhat_setNonce", [deployer.address, "0x2"]);
  }
}

describe("TablelandRigPilotsProxy", function () {
  let accounts: SignerWithAddress[];
  let Factory: ContractFactory;
  let snapshot: string;

  before(async function () {
    snapshot = await network.provider.send("evm_snapshot");
    accounts = await ethers.getSigners();
    // `TablelandRigPilots.initialize()` creates a table through the registry
    await useLocalTablelandMock(accounts[0]);
  });

  after(async function () {
    await network.provider.send("evm_revert", [snapshot]);
  });

  beforeEach(async function () {
    Factory = await ethers.getContractFactory("TablelandRigPilots");
  });

  it("Should have set implementation owner to deployer address", async function () {
    const pilots = await deploy(Factory);
    const owner = await pilots.owner();
    expect(owner).to.equal(accounts[0].address);
  });

  it("Should only allow owner to upgrade", async function () {
    const pilots = await deploy(Factory);
    const BadFactory = await ethers.getContractFactory("TablelandRigPilots", {
      signer: accounts[1],
    });
    await expect(update(pilots, BadFactory)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should not re-deploy proxy or implementation if unchanged", async function () {
    const pilots1 = await deploy(Factory);
    const pilots2 = await update(pilots1, Factory);
    expect(
      await upgrades.erc1967.getImplementationAddress(pilots1.address)
    ).to.equal(
      await upgrades.erc1967.getImplementationAddress(pilots2.address)
    );
    expect(pilots1.address).to.equal(pilots2.address);
  });
});

async function deploy(Factory: ContractFactory): Promise<TablelandRigPilots> {
  const pilots = (await upgrades.deployProxy(
    Factory,
    [ethers.constants.AddressZero],
    {
      kind: "uups",
    }
  )) as TablelandRigPilots;
  return await pilots.deployed();
}

async function update(
  proxy: Contract,
  Factory: ContractFactory
): Promise<TablelandRigPilots> {
  const pilots = (await upgrades.upgradeProxy(proxy.address, Factory, {
    kind: "uups",
  })) as TablelandRigPilots;
  return await pilots.deployed();
}
