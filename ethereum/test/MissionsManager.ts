/* eslint-disable no-unused-expressions */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Database, Validator } from "@tableland/sdk";
import { LocalTableland, getAccounts, getDatabase } from "@tableland/local";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { MissionsManager } from "../typechain-types";

const lt = new LocalTableland({
  silent: true,
});

before(async function () {
  lt.start();
  await lt.isReady();
});

after(async function () {
  await lt.shutdown();
});

const accounts = getAccounts();

describe("MissionsManager [ @skip-on-coverage ]", function () {
  let db: Database;
  let validator: Validator;

  let manager: MissionsManager;

  let missionsTableName: string;
  let contributionsTableName: string;

  async function deployFixture() {
    // 0. Init database
    db = getDatabase(accounts[0]);
    validator = new Validator(db.config);

    // 1. Create missions tables
    // Create missions table
    const { meta: missionsMeta } = await db
      .prepare(
        `
      CREATE TABLE missions (
        id integer primary key,
        name text not null,
        description text not null,
        tags text not null,
        requirements text not null,
        rewards text not null,
        deliverables text not null,
        contributions_start_block integer not null default 0,
        contributions_end_block integer not null default 0,
        max_number_of_contributions integer not null default 0,
        contributions_disabled integer not null default 0
      )`
      )
      .run();

    const missionsReceipt = await missionsMeta.txn!.wait();
    missionsTableName = missionsReceipt.name;
    const missionsTableId = missionsReceipt.tableId;

    // NOTE accepted is nullable, because it will go from null -> true/false when reviewed
    const { meta: contributionsMeta } = await db
      .prepare(
        `
      CREATE TABLE mission_contributions (
        id integer primary key,
        contributor text not null,
        mission_id integer not null,
        created_at integer not null,
        data text not null,

        accepted integer,
        acceptance_motivation text
      )`
      )
      .run();

    const contributionsReceipt = await contributionsMeta.txn!.wait();
    contributionsTableName = contributionsReceipt.name;
    const contributionsTableId = contributionsReceipt.tableId;

    // 3. Deploy contract
    const MissionsManagerFactory = await ethers.getContractFactory(
      "MissionsManager"
    );
    manager = await (
      (await MissionsManagerFactory.deploy(
        { id: missionsTableId, name: missionsTableName },
        {
          id: contributionsTableId,
          name: contributionsTableName,
        }
      )) as MissionsManager
    ).deployed();

    // 4. Grant contract permission to write to all missions tables
    await db
      .prepare(
        `GRANT INSERT, UPDATE ON ${contributionsTableName} TO '${manager.address}'`
      )
      .run();

    const { meta: grantMeta } = await db
      .prepare(`GRANT UPDATE ON ${missionsTableName} TO '${manager.address}'`)
      .run();

    await grantMeta.txn?.wait();
  }

  describe("setContributionsDisabled", () => {
    before(async function () {
      await loadFixture(deployFixture);
    });

    it("Default admin (owner) should be able to enable/disable contributions", async () => {
      const [admin, user] = accounts;

      const id = 1337;

      await db
        .prepare(
          `
      INSERT INTO ${missionsTableName}
       (id, name, description, tags, requirements, rewards, deliverables)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       `
        )
        .bind(
          id,
          "name",
          "description",
          JSON.stringify(["t1"]),
          JSON.stringify(["r1"]),
          JSON.stringify([{ amount: 1337, currency: "FT" }]),
          JSON.stringify([{ key: "deliv1", description: "Desc", type: "url" }])
        )
        .run();

      const txn = await manager
        .connect(admin)
        .setContributionsDisabled(BigNumber.from(id), true);
      const receipt = await txn.wait();

      const isDisabled = await manager
        .connect(user)
        .contributionsDisabled(BigNumber.from(id));

      expect(isDisabled).to.eq(true);

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: receipt.transactionHash,
      });

      const dbResult = await db
        .prepare(
          `SELECT contributions_disabled FROM ${missionsTableName} WHERE id = ${id}`
        )
        .first<{ contributions_disabled: number }>();

      expect(dbResult).to.eql({ contributions_disabled: 1 });
    });

    it("Regular user should not be able to enable/disable contributions", async () => {
      const [, user] = accounts;

      await expect(
        manager.connect(user).setContributionsDisabled(BigNumber.from(1), true)
      ).to.be.rejected;
    });

    it("Missions admin should be able to disable contributions", async () => {
      const [owner, , , missionsAdmin] = accounts;

      await expect(
        manager
          .connect(missionsAdmin)
          .setContributionsDisabled(BigNumber.from(1), true)
      ).to.be.rejected;

      await manager
        .connect(owner)
        .grantRole(manager.MISSIONS_ADMIN_ROLE(), missionsAdmin.address);

      await expect(
        manager
          .connect(missionsAdmin)
          .setContributionsDisabled(BigNumber.from(1), true)
      ).not.to.be.rejected;
    });
  });

  describe("submitMissionContribution", () => {
    before(async function () {
      await loadFixture(deployFixture);
    });

    it("does not allow contributing to disabled missions", async () => {
      const [admin, user1] = accounts;

      const txn = await manager
        .connect(admin)
        .setContributionsDisabled(BigNumber.from(1), true);

      await txn.wait();

      await expect(
        manager
          .connect(user1)
          .submitMissionContribution(BigNumber.from(1), "some-json-data")
      ).to.be.rejectedWith(/Contributions disabled/, "Should be rejected");
    });

    it("allows contributing to enabled missions", async () => {
      const [admin, user1] = accounts;

      const txn = await manager
        .connect(admin)
        .setContributionsDisabled(BigNumber.from(1), false);

      await txn.wait();

      const contribution = await manager
        .connect(user1)
        .submitMissionContribution(BigNumber.from(1), "some-json-data");

      const contributionReceipt = await contribution.wait();

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: contributionReceipt.transactionHash,
      });

      const dbResult = await db
        .prepare(
          `SELECT lower(contributor) as "contributor", data FROM ${contributionsTableName}`
        )
        .first<{ contributor: string; data: string }>();

      expect(dbResult).to.eql({
        contributor: user1.address.toLowerCase(),
        data: "some-json-data",
      });
    });
  });
});
