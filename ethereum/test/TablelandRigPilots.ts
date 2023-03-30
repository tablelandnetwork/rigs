import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TablelandTables } from "@tableland/evm";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, network, upgrades } from "hardhat";
import { TablelandRigPilots } from "../typechain-types";
import { BigNumber } from "ethers";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Pilots", function () {
  // Pilots contract deployment
  let accounts: SignerWithAddress[];
  let pilots: TablelandRigPilots;
  let parent: SignerWithAddress;

  // Use a fixture, which runs *once* to help ensure deterministic contract addresses
  async function deployPilotsFixture() {
    // First, deploy the `TablelandTables` registry contract
    // Required for creating table from contract in `initialize()`
    const TablelandTablesFactory = await ethers.getContractFactory(
      "TablelandTables"
    );
    const tables = await (
      (await upgrades.deployProxy(
        TablelandTablesFactory,
        ["https://foo.xyz/"],
        {
          kind: "uups",
        }
      )) as TablelandTables
    ).deployed();

    // Account setup
    accounts = await ethers.getSigners();
    parent = accounts[1];

    // Deploy the Pilots contract
    const PilotsFactory = await ethers.getContractFactory("TablelandRigPilots");
    pilots = await (
      (await PilotsFactory.deploy()) as TablelandRigPilots
    ).deployed();
    await (await pilots.initialize(parent.address)).wait();

    // Check pilots table creation
    const tableEvents = await tables.queryFilter(
      tables.filters.CreateTable(),
      0,
      100 // the event isn't in the same block as the `initPilots` txn (hardhat issue?)
    );
    const [event] = tableEvents ?? [];
    const pilotSessionsTableId = event.args?.tableId;
    expect(await pilots.connect(parent).pilotSessionsTable()).to.be.equal(
      `pilot_sessions_${network.config.chainId}_${pilotSessionsTableId}`
    );

    // Check can only init once
    await expect(
      pilots.initialize(ethers.constants.AddressZero)
    ).to.be.revertedWith("Initializable: contract is already initialized");
  }

  this.beforeAll(async function () {
    // Deploy the `TablelandRigPilots` contract
    await loadFixture(deployPilotsFixture);
  });

  describe("owner", function () {
    it("Should return contract parent", async function () {
      expect(await pilots.parent()).to.be.equal(parent.address);
    });
  });

  describe("trainRig", function () {
    it("Should only allow contract parent", async function () {
      const _pilots = pilots.connect(accounts[2]);

      await expect(
        _pilots.trainRig(ethers.constants.AddressZero, BigNumber.from(1))
      ).to.be.rejectedWith("Pilots: caller is not the parent");
    });
  });

  describe("pilotRig", function () {
    it("Should only allow contract parent", async function () {
      const _pilots = pilots.connect(accounts[2]);

      await expect(
        _pilots["pilotRig(address,uint256)"](
          ethers.constants.AddressZero,
          BigNumber.from(1)
        )
      ).to.be.rejectedWith("Pilots: caller is not the parent");

      await expect(
        _pilots["pilotRig(address,uint256,address,uint256)"](
          ethers.constants.AddressZero,
          BigNumber.from(1),
          ethers.constants.AddressZero,
          BigNumber.from(1)
        )
      ).to.be.rejectedWith("Pilots: caller is not the parent");
    });
  });

  describe("parkRig", function () {
    it("Should only allow contract parent", async function () {
      const _pilots = pilots.connect(accounts[2]);

      await expect(
        _pilots.parkRig(ethers.constants.AddressZero, BigNumber.from(1))
      ).to.be.rejectedWith("Pilots: caller is not the parent");
    });
  });

  describe("updateSessionOwner", function () {
    it("Should only allow contract parent", async function () {
      const _pilots = pilots.connect(accounts[2]);

      await expect(
        _pilots.updateSessionOwner(
          BigNumber.from(1),
          ethers.constants.AddressZero
        )
      ).to.be.rejectedWith("Pilots: caller is not the parent");
    });
  });
});
