import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import type { TablelandTables, TablelandRigPilots } from "../../typechain-types";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("TablelandRigPilotsProxy", function () {
  let accounts: SignerWithAddress[];
  let Factory: ContractFactory;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    Factory = await ethers.getContractFactory("TablelandRigPilots");

    const TablelandTablesFactory = await ethers.getContractFactory(
      "TablelandTables"
    );
    await (
      (await upgrades.deployProxy(
        TablelandTablesFactory,
        ["https://foo.xyz/"],
        {
          kind: "uups",
        }
      )) as TablelandTables
    ).deployed();
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
    ["0x31346Df523caE0a44eB9fb49E153D0e60E8016b6"],
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
