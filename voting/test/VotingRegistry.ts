import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Database, Validator } from "@tableland/sdk";
import { LocalTableland, getAccounts, getDatabase } from "@tableland/local";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { VotingRegistry } from "../typechain-types";

const lt = new LocalTableland({
  silent: true,
});

before(async function () {
  // this.timeout(25000);
  lt.start();
  await lt.isReady();
});

after(async function () {
  await lt.shutdown();
});

// TODO: remove this, the validator gets really slow/hangs sometimes in tests
const pollForReceiptByTransactionHash = async (
  validator: Validator,
  params: { chainId: number; transactionHash: string }
) => {
  try {
    return await validator.pollForReceiptByTransactionHash(params);
  } catch (_) {}

  try {
    return await validator.pollForReceiptByTransactionHash(params);
  } catch (_) {}

  try {
    return await validator.pollForReceiptByTransactionHash(params);
  } catch (_) {}

  try {
    return await validator.pollForReceiptByTransactionHash(params);
  } catch (_) {}

  try {
    return await validator.pollForReceiptByTransactionHash(params);
  } catch (_) {}
};

const accounts = getAccounts();

interface PilotSession {
  rigId: number;
  owner: string;
  startTime: number;
  endTime?: number;
}

describe("VotingRegistry", function () {
  let db: Database;
  let validator: Validator;

  let pilotSessionsTableName: string;
  let ftRewardsTableName: string;

  let registry: VotingRegistry;
  let ftSnapshotTableName: string;
  let votesTableName: string;
  let alternativesTableName: string;

  async function deployFixture() {
    // 0. Init database
    db = getDatabase(accounts[0]);
    validator = new Validator(db.config);

    // 1. Create pilotSessions table
    const { meta: pilotRewardsMeta } = await db
      .prepare(
        "CREATE TABLE pilot_sessions (id integer primary key, rig_id integer NOT NULL, owner text NOT NULL, pilot_contract text, pilot_id integer, start_time integer NOT NULL, end_time integer)"
      )
      .all();

    const pilotRewardsReceipt = await pilotRewardsMeta.txn.wait();
    pilotSessionsTableName = pilotRewardsReceipt.name;

    const pilotSessions: PilotSession[] = [
      { rigId: 1, owner: accounts[1].address, startTime: 0, endTime: 111 },
      { rigId: 2, owner: accounts[2].address, startTime: 0, endTime: 222 },
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

    // 2. Create ftRewards table
    let { meta: ftRewardsMeta } = await db
      .prepare(
        "CREATE TABLE ft_rewards (block_num integer NOT NULL, recipient text NOT NULL, reason text NOT NULL, amount integer NOT NULL, proposal_id integer)"
      )
      .all();

    const ftRewardsReceipt = await ftRewardsMeta.txn.wait();
    ftRewardsTableName = ftRewardsReceipt.name;
    const ftRewardsTableId = ftRewardsReceipt.tableId;

    // 3. Create contract
    const VotingRegistryFactory = await ethers.getContractFactory(
      "VotingRegistry"
    );
    registry = await (
      (await VotingRegistryFactory.deploy(
        pilotSessionsTableName,
        ftRewardsTableName,
        ftRewardsTableId
      )) as VotingRegistry
    ).deployed();

    const tableNames = await registry.connect(accounts[0]).tableNames();
    votesTableName = tableNames.votesTableName;
    alternativesTableName = tableNames.alternativesTableName;
    ftSnapshotTableName = tableNames.ftSnapshotTableName;

    // 4. Grant contract permission to write to ftRewards table
    const { meta: grantMeta } = await db
      .prepare(`GRANT INSERT ON ${ftRewardsTableName} TO '${registry.address}'`)
      .all();

    await grantMeta.txn.wait();
  }

  describe("createProposal", () => {
    beforeEach(async function () {
      await loadFixture(deployFixture);
    });

    it("Owner should be able to create a proposal", async () => {
      const [admin, user] = accounts;

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["one", "two", "three"],
          "my vote",
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200)
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      const proposal = await registry
        .connect(user)
        .proposal(BigNumber.from(proposalId));
      expect({ ...proposal }).to.deep.include({
        name: "my vote",
        startBlockNumber: BigNumber.from(100),
        endBlockNumber: BigNumber.from(200),
      });
    });

    it("Should insert alternatives", async () => {
      const [admin, user] = accounts;

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["one", "two", "three"],
          "my vote",
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200)
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      // Wait until all changes have been materialized
      await pollForReceiptByTransactionHash(validator, {
        chainId: 31337,
        transactionHash: receipt.transactionHash,
      });

      const alternatives = await db
        .prepare(
          `SELECT * FROM ${alternativesTableName} WHERE proposal_id = ${proposalId}`
        )
        .all<{ id: number; description: string; proposal_id: number }>();

      expect(alternatives.results).to.deep.include.members([
        { id: 1, description: "one", proposal_id: proposalId },
        { id: 2, description: "two", proposal_id: proposalId },
        { id: 3, description: "three", proposal_id: proposalId },
      ]);
    });

    it("Should snapshot voting power", async () => {
      const [admin, user] = accounts;

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["one", "two", "three"],
          "my vote",
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200)
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      // Wait until all changes have been materialized
      const r = await pollForReceiptByTransactionHash(validator, {
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
      const [admin, user] = accounts;

      const alternatives = ["alt1", "alt2", "alt3", "alt4"];

      const txn = await registry
        .connect(admin)
        .createProposal(
          alternatives,
          "my vote",
          BigNumber.from(100),
          BigNumber.from(100),
          BigNumber.from(200)
        );
      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      // Wait until all changes have been materialized
      await pollForReceiptByTransactionHash(validator, {
        chainId: 31337,
        transactionHash: receipt.transactionHash,
      });

      const votes = await db
        .prepare(
          `SELECT * FROM ${votesTableName} WHERE proposal_id = ${proposalId}`
        )
        .all<{
          address: string;
          alternative_id: number;
          weight: number;
          proposal_id: number;
        }>();

      const eligibleAccounts = [
        accounts[1].address,
        accounts[2].address,
        accounts[3].address,
      ];

      const expectedVotes = eligibleAccounts.flatMap((address) =>
        alternatives.map((_, alternative_id) => ({
          address,
          alternative_id: alternative_id + 1,
          weight: 0,
          proposal_id: proposalId,
        }))
      );

      expect(votes.results).to.deep.include.members(expectedVotes);
    });
  });

  describe("vote", () => {
    beforeEach(async function () {
      await loadFixture(deployFixture);
    });

    it("does not allow voting before the proposal opened or after it closed", async () => {
      const [admin, user1, user2] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["a", "b"],
          "my vote",
          BigNumber.from(100),
          BigNumber.from(blockNumber + 10),
          BigNumber.from(blockNumber + 20)
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(100)]
          )
      ).to.be.rejectedWith(/Vote has not started/, "Should be rejected");

      // advance 11 blocks
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(11)]);

      const vote = await registry
        .connect(user1)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1)],
          [BigNumber.from(100)]
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
            [BigNumber.from(100)]
          )
      ).to.be.rejectedWith(/Vote has ended/, "Should be rejected");
    });

    it("does not allow voting with mixed length on alternatives and weights", async () => {
      const [admin, user1] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["a", "b"],
          "my vote",
          BigNumber.from(100),
          BigNumber.from(blockNumber + 10),
          BigNumber.from(blockNumber + 20)
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      // advance 11 blocks
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(11)]);

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1), BigNumber.from(2)],
            [BigNumber.from(100)]
          )
      ).to.be.rejectedWith(/Mismatched/, "Should be rejected");

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(80), BigNumber.from(20)]
          )
      ).to.be.rejectedWith(/Mismatched/, "Should be rejected");
    });

    it("does not allow voting with an incorrect weight sum", async () => {
      const [admin, user1] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["a", "b"],
          "my vote",
          BigNumber.from(100),
          BigNumber.from(blockNumber + 10),
          BigNumber.from(blockNumber + 20)
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      // advance 11 blocks
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(11)]);

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(80)]
          )
      ).to.be.rejectedWith(/Incorrect weights/, "Should be rejected");

      await expect(
        registry
          .connect(user1)
          .vote(
            BigNumber.from(proposalId),
            [BigNumber.from(1)],
            [BigNumber.from(120)]
          )
      ).to.be.rejectedWith(/Incorrect weights/, "Should be rejected");
    });

    it("correctly updates the votes table when voting", async () => {
      const [admin, user1, user2, _, user4] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["a", "b", "c"],
          "vote",
          BigNumber.from(100),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100)
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      // User 1 and 2 are eligible for the vote, user 4 is not
      const vote1 = await registry
        .connect(user1)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3)],
          [BigNumber.from(40), BigNumber.from(30), BigNumber.from(30)]
        );

      const vote2 = await registry
        .connect(user2)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1)],
          [BigNumber.from(100)]
        );

      const vote3 = await registry
        .connect(user4)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(2)],
          [BigNumber.from(100)]
        );

      const voteReceipt = await vote3.wait();

      // Wait until all changes have been materialized
      await pollForReceiptByTransactionHash(validator, {
        chainId: 31337,
        transactionHash: voteReceipt.transactionHash,
      });

      const votes = await db
        .prepare(
          `SELECT * FROM ${votesTableName} WHERE weight > 0 AND proposal_id = ${proposalId}`
        )
        .all<{
          address: string;
          alternative_id: number;
          weight: number;
          proposal_id: number;
        }>();

      const expectedVotes = [
        {
          proposal_id: proposalId,
          address: user1.address,
          alternative_id: 1,
          weight: 40,
        },
        {
          proposal_id: proposalId,
          address: user1.address,
          alternative_id: 2,
          weight: 30,
        },
        {
          proposal_id: proposalId,
          address: user1.address,
          alternative_id: 3,
          weight: 30,
        },
        {
          proposal_id: proposalId,
          address: user2.address,
          alternative_id: 1,
          weight: 100,
        },
      ];

      expect(votes.results).to.deep.include.members(expectedVotes);
    });
  });

  describe("distributeParticipantFtRewards", async () => {
    beforeEach(async function () {
      await loadFixture(deployFixture);
    });

    it("cannot be called before a vote has ended", async () => {
      const [admin] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["a", "b", "c"],
          "vote",
          BigNumber.from(100),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100)
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      await expect(
        registry
          .connect(admin)
          .distributeParticipantFtRewards(BigNumber.from(proposalId))
      ).to.be.rejectedWith(/Vote has not ended/, "Should be rejected");
    });

    it("cannot be called again after rewards have been distributed", async () => {
      const [admin] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["a", "b", "c"],
          "vote",
          BigNumber.from(25_000),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100)
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      // close the vote
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(100)]);

      const distribution = await registry
        .connect(admin)
        .distributeParticipantFtRewards(BigNumber.from(proposalId));

      expect(distribution.hash).to.not.be.null;

      await expect(
        registry
          .connect(admin)
          .distributeParticipantFtRewards(BigNumber.from(proposalId))
      ).to.be.rejectedWith(
        /Rewards have been distributed/,
        "Should be rejected"
      );
    });

    it("distributes rewards to all participiating voters", async () => {
      const [admin, user1, user2, _, user4] = accounts;

      const { number: blockNumber } = await ethers.provider.getBlock("latest");

      const txn = await registry
        .connect(admin)
        .createProposal(
          ["a", "b", "c"],
          "vote",
          BigNumber.from(25_000),
          BigNumber.from(blockNumber),
          BigNumber.from(blockNumber + 100)
        );

      const receipt = await txn.wait();
      const event = receipt.events?.find((v) => v.event === "ProposalCreated");
      const proposalId = event.args?.proposalId.toNumber();

      await registry
        .connect(user1)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3)],
          [BigNumber.from(40), BigNumber.from(30), BigNumber.from(30)]
        );

      await registry
        .connect(user2)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(1)],
          [BigNumber.from(100)]
        );

      await registry
        .connect(user4)
        .vote(
          BigNumber.from(proposalId),
          [BigNumber.from(2)],
          [BigNumber.from(100)]
        );

      // close the vote
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(100)]);

      const distribution = await registry
        .connect(admin)
        .distributeParticipantFtRewards(BigNumber.from(proposalId));

      const distributionReceipt = await distribution.wait();

      // Wait until all changes have been materialized
      await pollForReceiptByTransactionHash(validator, {
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
