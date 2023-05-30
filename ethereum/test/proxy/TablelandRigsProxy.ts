import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import { ethers, upgrades } from "hardhat";
import { utils, BigNumber, Contract, ContractFactory } from "ethers";
import { buildTree } from "../../helpers/allowlist";
import type { TablelandRigs } from "../../typechain-types";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("TablelandRigsProxy", function () {
  let accounts: SignerWithAddress[];
  let Factory: ContractFactory;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    Factory = await ethers.getContractFactory("TablelandRigs");
  });

  it("Should have set implementation owner to deployer address", async function () {
    const list = {
      [accounts[1].address]: { freeAllowance: 1, paidAllowance: 1 },
    };
    const tree = buildTree(list);
    const rigs = await deploy(
      Factory,
      accounts[2].address,
      accounts[3].address,
      tree.getHexRoot()
    );
    const owner = await rigs.owner();
    expect(owner).to.equal(accounts[0].address);
  });

  it("Should only allow owner to upgrade", async function () {
    const list = {
      [accounts[1].address]: { freeAllowance: 1, paidAllowance: 1 },
    };
    const tree = buildTree(list);
    const rigs = await deploy(
      Factory,
      accounts[2].address,
      accounts[3].address,
      tree.getHexRoot()
    );
    const BadFactory = await ethers.getContractFactory("TablelandRigs", {
      signer: accounts[1],
    });
    await expect(update(rigs, BadFactory)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should not re-deploy proxy or implementation if unchanged", async function () {
    const list = {
      [accounts[1].address]: { freeAllowance: 1, paidAllowance: 1 },
    };
    const tree = buildTree(list);
    const rigs1 = await deploy(
      Factory,
      accounts[2].address,
      accounts[3].address,
      tree.getHexRoot()
    );
    const rigs2 = await update(rigs1, Factory);
    expect(
      await upgrades.erc1967.getImplementationAddress(rigs1.address)
    ).to.equal(await upgrades.erc1967.getImplementationAddress(rigs2.address));
    expect(rigs1.address).to.equal(rigs2.address);
  });
});

async function deploy(
  Factory: ContractFactory,
  beneficiary: string,
  splitter: string,
  root: string
): Promise<TablelandRigs> {
  const rigs = (await upgrades.deployProxy(
    Factory,
    [
      BigNumber.from(3000),
      utils.parseEther("0.05"),
      beneficiary,
      splitter,
      root,
      root,
    ],
    {
      kind: "uups",
    }
  )) as TablelandRigs;
  return await rigs.deployed();
}

async function update(
  proxy: Contract,
  Factory: ContractFactory
): Promise<TablelandRigs> {
  const rigs = (await upgrades.upgradeProxy(proxy.address, Factory, {
    kind: "uups",
  })) as TablelandRigs;
  return await rigs.deployed();
}
