/* eslint-disable no-unused-expressions */
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Database, Validator } from "@tableland/sdk";
import { getAccounts, getDatabase } from "@tableland/local";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { VotingRegistry } from "../typechain-types";

const accounts = getAccounts();

interface PilotSession {
  rigId: number;
  owner: string;
  startTime: number;
  endTime?: number;
}

describe("VotingRegistry [ @skip-on-coverage ]", function () {
  let db: Database;
  let validator: Validator;

  let pilotSessionsTableName: string;
  let ftRewardsTableName: string;

  let registry: VotingRegistry;
  let proposalsTableName: string;
  let ftSnapshotTableName: string;
  let votesTableName: string;
  let optionsTableName: string;

  async function deployFixture() {
    // 0. Init database
    db = getDatabase(accounts[0]);
    validator = new Validator(db.config);

    // 1. Create pre-existing tables, pilot sessions and ft rewards & populate
    const { meta: pilotRewardsMeta } = await db
      .prepare(
        "CREATE TABLE pilot_sessions (id integer primary key, rig_id integer NOT NULL, owner text NOT NULL, pilot_contract text, pilot_id integer, start_time integer NOT NULL, end_time integer)"
      )
      .all();

    const pilotRewardsReceipt = await pilotRewardsMeta.txn?.wait();
    if (!pilotRewardsReceipt) throw Error("Did not get pilotRewardsReceipt");
    pilotSessionsTableName = pilotRewardsReceipt.name;
    const pilotSessionsTableId = pilotRewardsReceipt.tableId;

    const pilotSessions: PilotSession[] = [
      { rigId: 1, owner: accounts[1].address, startTime: 0, endTime: 70 },
      { rigId: 1, owner: accounts[1].address, startTime: 100, endTime: 111 },
      { rigId: 2, owner: accounts[2].address, startTime: 0, endTime: 111 },
      { rigId: 2, owner: accounts[2].address, startTime: 111, endTime: 222 },
      { rigId: 3, owner: accounts[3].address, startTime: 0, endTime: 333 },
    ];

    const stmnt = db.prepare(
      `INSERT INTO ${pilotSessionsTableName} (rig_id, owner, start_time, end_time) VALUES (?, ?, ?, ?)`
    );
    await db.batch(
      pilotSessions.map((v) =>
        stmnt.bind(v.rigId, v.owner, v.startTime, v.endTime)
      )
    );

    const { meta: ftRewardsMeta } = await db
      .prepare(
        "CREATE TABLE ft_rewards (block_num integer NOT NULL, recipient text NOT NULL, reason text NOT NULL, amount integer NOT NULL, proposal_id integer)"
      )
      .all();

    const ftRewardsReceipt = await ftRewardsMeta.txn?.wait();
    if (!ftRewardsReceipt) throw Error("Did not get ftRewardsReceipt");

    ftRewardsTableName = ftRewardsReceipt.name;
    const ftRewardsTableId = ftRewardsReceipt.tableId;

    const ftRewardInsert = await db.exec(
      db
        .prepare(
          `INSERT INTO ${ftRewardsTableName} (block_num, recipient, reason, amount) VALUES (0, ?, '', 30)`
        )
        .bind(accounts[1].address)
        .toString()
    );
    await ftRewardInsert.meta.txn!.wait();

    // 2. Create voting tables
    const { meta: proposalsMeta } = await db
      .prepare(
        "CREATE TABLE proposals (id integer NOT NULL, name text NOT NULL, description_cid text, voting_system integer NOT NULL, voter_ft_reward integer NOT NULL, created_at integer NOT NULL, start_block integer NOT NULL, end_block integer NOT NULL)"
      )
      .all();

    const proposalsReceipt = await proposalsMeta.txn!.wait();
    proposalsTableName = proposalsReceipt.name;
    const proposalsTableId = proposalsReceipt.tableId;

    const { meta: ftSnapshotMeta } = await db
      .prepare(
        "CREATE TABLE ft_snapshot (address text NOT NULL, ft integer NOT NULL, proposal_id integer NOT NULL, UNIQUE(address, proposal_id))"
      )
      .all();

    const ftSnapshotReceipt = await ftSnapshotMeta.txn!.wait();
    ftSnapshotTableName = ftSnapshotReceipt.name;
    const ftSnapshotTableId = ftSnapshotReceipt.tableId;

    const { meta: votesMeta } = await db
      .prepare(
        "CREATE TABLE votes (address text NOT NULL, proposal_id integer NOT NULL, option_id integer NOT NULL, weight integer NOT NULL, comment text, UNIQUE(address, option_id, proposal_id))"
      )
      .all();

    const votesReceipt = await votesMeta.txn!.wait();
    votesTableName = votesReceipt.name;
    const votesTableId = votesReceipt.tableId;

    const { meta: optionsMeta } = await db
      .prepare(
        "CREATE TABLE options (id integer NOT NULL, proposal_id integer NOT NULL, description text NOT NULL)"
      )
      .all();

    const optionsReceipt = await optionsMeta.txn!.wait();
    optionsTableName = optionsReceipt.name;
    const optionsTableId = optionsReceipt.tableId;

    // 3. Deploy contract
    const VotingRegistryFactory = await ethers.getContractFactory(
      "VotingRegistry"
    );
    registry = await (
      (await VotingRegistryFactory.deploy(
        { id: proposalsTableId, name: proposalsTableName },
        { id: ftSnapshotTableId, name: ftSnapshotTableName },
        { id: votesTableId, name: votesTableName },
        { id: optionsTableId, name: optionsTableName },
        { id: pilotSessionsTableId, name: pilotSessionsTableName },
        { id: ftRewardsTableId, name: ftRewardsTableName },
        BigNumber.from(0)
      )) as VotingRegistry
    ).deployed();

    // 4. Grant contract permission to write to all voting tables and the ftRewardsTable
    await db
      .prepare(`GRANT INSERT ON ${proposalsTableName} TO '${registry.address}'`)
      .run();
    await db
      .prepare(
        `GRANT INSERT ON ${ftSnapshotTableName} TO '${registry.address}'`
      )
      .run();
    await db
      .prepare(
        `GRANT INSERT, UPDATE ON ${votesTableName} TO '${registry.address}'`
      )
      .run();
    await db
      .prepare(`GRANT INSERT ON ${optionsTableName} TO '${registry.address}'`)
      .run();
    const { meta: grantMeta } = await db
      .prepare(`GRANT INSERT ON ${ftRewardsTableName} TO '${registry.address}'`)
      .run();

    await grantMeta.txn?.wait();
  }

  describe("createProposal", () => {
    before(async function () {
      await loadFixture(deployFixture);
    });

    it("Default admin (owner) should be able to create a proposal", async () => {
      const [admin, user] = accounts;

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200),
          ["one", "two", "three"]
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      const proposal = await registry
        .connect(user)
        .proposal(BigNumber.from(proposalId));

      expect({ ...proposal }).to.deep.include({
        startBlockNumber: BigNumber.from(100),
        endBlockNumber: BigNumber.from(200),
      });
    });

    it("Regular user should not be able to create a proposal", async () => {
      const [, user] = accounts;

      await expect(
        registry
          .connect(user)
          .createProposal(
            "my vote",
            "some-cid",
            BigNumber.from(0),
            BigNumber.from(100),
            BigNumber.from(100),
            BigNumber.from(200),
            ["one", "two", "three"]
          )
      ).to.be.rejected;
    });

    it("Voting admin should be able to create a proposal", async () => {
      const [owner, , , votingAdmin] = accounts;

      await expect(
        registry
          .connect(votingAdmin)
          .createProposal(
            "my vote",
            "some-cid",
            BigNumber.from(0),
            BigNumber.from(100),
            BigNumber.from(100),
            BigNumber.from(200),
            ["one", "two", "three"]
          )
      ).to.be.rejected;

      await registry
        .connect(owner)
        .grantRole(registry.VOTING_ADMIN_ROLE(), votingAdmin.address);

      await expect(
        registry
          .connect(votingAdmin)
          .createProposal(
            "my vote",
            "some-cid",
            BigNumber.from(0),
            BigNumber.from(100),
            BigNumber.from(100),
            BigNumber.from(200),
            ["one", "two", "three"]
          )
      ).not.to.be.rejected;
    });

    it("Should insert the proposal", async () => {
      const [admin] = accounts;

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200),
          ["one", "two", "three"]
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: receipt.transactionHash,
      });

      const proposal = await db
        .prepare(
          `SELECT id, name, voting_system, start_block, end_block FROM ${proposalsTableName} WHERE id = ${proposalId}`
        )
        .first<{
          id: number;
          name: string;
          voting_system: number;
          start_block: number;
          end_block: number;
        }>();

      expect(proposal).to.deep.include({
        id: proposalId,
        name: "my vote",
        voting_system: 0,
        start_block: 100,
        end_block: 200,
      });
    });

    it("Should insert options", async () => {
      const [admin] = accounts;

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200),
          ["one", "two", "three"]
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: receipt.transactionHash,
      });

      const options = await db
        .prepare(
          `SELECT * FROM ${optionsTableName} WHERE proposal_id = ${proposalId}`
        )
        .all<{ id: number; description: string; proposal_id: number }>();

      expect(options.results).to.deep.include.members([
        { id: 1, description: "one", proposal_id: proposalId },
        { id: 2, description: "two", proposal_id: proposalId },
        { id: 3, description: "three", proposal_id: proposalId },
      ]);
    });

    it("Should snapshot voting power", async () => {
      const [admin] = accounts;

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200),
          ["one", "two", "three"]
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: receipt.transactionHash,
      });

      const snapshot = await db
        .prepare(
          `SELECT * FROM ${ftSnapshotTableName} WHERE proposal_id = ${proposalId}`
        )
        .all<{ ft: number; address: string }>();

      expect(snapshot.results).to.deep.include.members([
        { ft: 111, address: accounts[1].address, proposal_id: proposalId },
        { ft: 222, address: accounts[2].address, proposal_id: proposalId },
        { ft: 333, address: accounts[3].address, proposal_id: proposalId },
      ]);
    });

    it("Should pre-insert votes for eligible wallets", async () => {
      const [admin] = accounts;

      const options = ["alt1", "alt2", "alt3", "alt4"];

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200),
          options
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: receipt.transactionHash,
      });

      const votes = await db
        .prepare(
          `SELECT * FROM ${votesTableName} WHERE proposal_id = ${proposalId}`
        )
        .all<{
          address: string;
          comment: string;
          option_id: number;
          weight: number;
          proposal_id: number;
        }>();

      const eligibleAccounts = [
        accounts[1].address,
        accounts[2].address,
        accounts[3].address,
      ];

      const expectedVotes = eligibleAccounts.flatMap((address) =>
        options.map((_, optionId) => ({
          address,
          // eslint-disable-next-line camelcase
          option_id: optionId + 1,
          weight: 0,
          proposal_id: proposalId,
          comment: null,
        }))
      );

      expect(votes.results).to.deep.include.members(expectedVotes);
    });
  });

  describe("vote", () => {
    before(async function () {
      await loadFixture(deployFixture);
    });

    it("does not allow voting before the proposal opened or after it closed", async () => {
      const [admin, user1, user2] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(blockNumber + 10),
          BigNumber.from(blockNumber + 20),
          ["a", "b"]
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(100)],
            [""]
          )
      ).to.be.rejectedWith(/Vote has not started/, "Should be rejected");

      // advance 11 blocks
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(11)]);

      const vote = await registry
        .connect(user1)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1)],
          [BigNumber.from(100)],
          [""]
        );

      expect(vote.hash).to.not.be.null;

      // advance 11 blocks
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(11)]);

      await expect(
        registry
          .connect(user2)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(100)],
            [""]
          )
      ).to.be.rejectedWith(/Vote has ended/, "Should be rejected");
    });

    it("does not allow voting with mixed length on options and weights", async () => {
      const [admin, user1] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(blockNumber + 10),
          BigNumber.from(blockNumber + 20),
          ["a", "b"]
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // advance 11 blocks
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(11)]);

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1), BigNumber.from(2)],
            [BigNumber.from(100)],
            [""]
          )
      ).to.be.rejectedWith(/Mismatched/, "Should be rejected");

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(80), BigNumber.from(20)],
            [""]
          )
      ).to.be.rejectedWith(/Mismatched/, "Should be rejected");
    });

    it("does not allow voting with an incorrect weight sum", async () => {
      const [admin, user1] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          "my vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(blockNumber + 10),
          BigNumber.from(blockNumber + 20),
          ["a", "b"]
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // advance 11 blocks
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(11)]);

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(80)],
            [""]
          )
      ).to.be.rejectedWith(/Incorrect weights/, "Should be rejected");

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(120)],
            [""]
          )
      ).to.be.rejectedWith(/Incorrect weights/, "Should be rejected");
    });

    it("correctly updates the votes table when voting", async () => {
      const [admin, user1, user2, , user4] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          "vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100),
          ["a", "b", "c"]
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // User 1 and 2 are eligible for the vote, user 4 is not
      await registry
        .connect(user1)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3)],
          [BigNumber.from(40), BigNumber.from(30), BigNumber.from(30)],
          ["", "", ""]
        );

      await registry
        .connect(user2)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1)],
          [BigNumber.from(100)],
          [""]
        );

      const vote3 = await registry
        .connect(user4)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(2)],
          [BigNumber.from(100)],
          [""]
        );

      const voteReceipt = await vote3.wait();

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: voteReceipt.transactionHash,
      });

      const votes = await db
        .prepare(
          `SELECT * FROM ${votesTableName} WHERE weight > 0 AND proposal_id = ${proposalId}`
        )
        .all<{
          address: string;
          option_id: number;
          weight: number;
          comment: string;
          proposal_id: number;
        }>();

      const expectedVotes = [
        {
          proposal_id: proposalId,
          address: user1.address,
          option_id: 1,
          weight: 40,
          comment: "",
        },
        {
          proposal_id: proposalId,
          address: user1.address,
          option_id: 2,
          weight: 30,
          comment: "",
        },
        {
          proposal_id: proposalId,
          address: user1.address,
          option_id: 3,
          weight: 30,
          comment: "",
        },
        {
          proposal_id: proposalId,
          address: user2.address,
          option_id: 1,
          weight: 100,
          comment: "",
        },
      ];

      expect(votes.results).to.deep.include.members(expectedVotes);
    });
  });

  describe("distributeVoterRewards", async () => {
    before(async function () {
      await loadFixture(deployFixture);
    });

    it("cannot be called before a vote has ended", async () => {
      const [admin] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          "vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(100),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100),
          ["a", "b", "c"]
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      await expect(
        registry
          .connect(admin)
          .distributeVoterRewards(BigNumber.from(proposalId))
      ).to.be.rejectedWith(/Vote has not ended/, "Should be rejected");
    });

    it("cannot be called again after rewards have been distributed", async () => {
      const [admin] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          "vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(25_000),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100),
          ["a", "b", "c"]
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      // close the vote
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(100)]);

      const distribution = await registry
        .connect(admin)
        .distributeVoterRewards(BigNumber.from(proposalId));

      expect(distribution.hash).to.not.be.null;

      await expect(
        registry
          .connect(admin)
          .distributeVoterRewards(BigNumber.from(proposalId))
      ).to.be.rejectedWith(
        /Rewards have been distributed/,
        "Should be rejected"
      );
    });

    it("distributes rewards to all participiating voters", async () => {
      const [admin, user1, user2, , user4] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          "vote",
          "some-cid",
          BigNumber.from(0),
          BigNumber.from(25_000),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100),
          ["a", "b", "c"]
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event?.args?.proposalId.toNumber();

      await registry
        .connect(user1)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3)],
          [BigNumber.from(40), BigNumber.from(30), BigNumber.from(30)],
          ["", "", ""]
        );

      await registry
        .connect(user2)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1)],
          [BigNumber.from(100)],
          [""]
        );

      await registry
        .connect(user4)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(2)],
          [BigNumber.from(100)],
          [""]
        );

      // close the vote
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(100)]);

      const distribution = await registry
        .connect(admin)
        .distributeVoterRewards(BigNumber.from(proposalId));

      const distributionReceipt = await distribution.wait();

      // Wait until all changes have been materialized
      await validator.pollForReceiptByTransactionHash({
        chainId: 31337,
        transactionHash: distributionReceipt.transactionHash,
      });

      const ftRewards = await db
        .prepare(
          `SELECT recipient, amount, proposal_id FROM ${ftRewardsTableName}`
        )
        .all<{ receipent: string; amount: number; proposal_id: number }>();

      const expectedRewards = [
        {
          recipient: user1.address,
          amount: 25_000,
          proposal_id: proposalId,
        },
        {
          recipient: user2.address,
          amount: 25_000,
          proposal_id: proposalId,
        },
      ];

      expect(ftRewards.results).to.deep.include.members(expectedRewards);
    });
  });
});
