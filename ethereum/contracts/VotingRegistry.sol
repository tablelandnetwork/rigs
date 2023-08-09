// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {TablelandDeployments} from "@tableland/evm/contracts/utils/TablelandDeployments.sol";
import {ITablelandTables} from "@tableland/evm/contracts/interfaces/ITablelandTables.sol";
import {IVotingRegistry} from "./IVotingRegistry.sol";
import "@tableland/evm/contracts/utils/SQLHelpers.sol";

/// @title An implementation of IVotingRegistry that records proposals, options, votes and voter rewards in tableland tables.
contract VotingRegistry is AccessControl, IVotingRegistry {
    /// @dev keccak256("VOTING_ADMIN_ROLE")
    bytes32 public constant VOTING_ADMIN_ROLE =
        0x26e5e0c1d827967646b29471a0f5eef941c85bdbb97c194dc3fa6291a994a148;

    /// @dev Struct that holds information about a Tableland table
    struct TableInfo {
        uint256 id;
        string name;
    }

    TableInfo private _proposalsTable;
    TableInfo private _ftSnapshotTable;
    TableInfo private _votesTable;
    TableInfo private _optionsTable;
    TableInfo private _pilotSessionsTable;
    TableInfo private _ftRewardsTable;

    /// @dev The next proposal ID to be created.
    uint256 private _proposalCounter;

    /// @dev Mapping from proposal ID to proposal details.
    mapping(uint256 => Proposal) private _proposals;

    // =============================
    //        CONSTRUCTOR
    // =============================

    constructor(
        TableInfo memory proposalsTable,
        TableInfo memory ftSnapshotTable,
        TableInfo memory votesTable,
        TableInfo memory optionsTable,
        TableInfo memory pilotSessionsTable,
        TableInfo memory ftRewardsTable,
        uint256 startingProposalId
    ) {
        _proposalsTable = proposalsTable;
        _ftSnapshotTable = ftSnapshotTable;
        _votesTable = votesTable;
        _optionsTable = optionsTable;
        _pilotSessionsTable = pilotSessionsTable;
        _ftRewardsTable = ftRewardsTable;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VOTING_ADMIN_ROLE, msg.sender);

        _proposalCounter = startingProposalId;
    }

    // =============================
    //        IVOTINGREGISTRY
    // =============================

    /// @dev Creates a new proposal.
    /// Creating a new proposal will:
    /// 1) Insert a new row in the proposals table
    /// 2) Insert options in the options table
    /// 3) Snapshot all voting power
    /// 4) Insert the 'cross product' of all eligible voter addresses
    ///    and options.
    /// @inheritdoc IVotingRegistry
    function createProposal(
        string calldata name,
        string calldata descriptionCid,
        VotingSystem votingSystem,
        uint256 voterFtReward,
        uint256 startBlockNumber,
        uint256 endBlockNumber,
        string[] calldata options
    ) external onlyRole(VOTING_ADMIN_ROLE) returns (uint256 proposalId) {
        // We only support Weighted voting right now
        require(
            votingSystem == VotingSystem.Weighted,
            "Unsupported voting system"
        );

        proposalId = _proposalCounter++;

        string memory proposalIdString = Strings.toString(proposalId);

        _insertProposal(
            proposalIdString,
            name,
            descriptionCid,
            votingSystem,
            voterFtReward,
            startBlockNumber,
            endBlockNumber
        );
        _insertOptions(proposalIdString, options);
        _snapshotVotingPower(proposalIdString);
        _insertEligibleVotes(proposalIdString, options);

        _proposals[proposalId] = Proposal(
            startBlockNumber,
            endBlockNumber,
            voterFtReward,
            name,
            votingSystem,
            false
        );

        emit ProposalCreated(proposalId);

        return proposalId;
    }

    /// @inheritdoc IVotingRegistry
    function proposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        return _proposals[proposalId];
    }

    /// @notice Cast a vote for a proposal. Will revert if the proposal hasn't opened yet or if it has ended.
    /// The vote will only be recorded if you are eligible to vote.
    ///
    /// @inheritdoc IVotingRegistry
    function vote(
        uint256 proposalId,
        uint256[] calldata options,
        uint256[] calldata weights,
        string[] memory comments
    ) external {
        Proposal memory proposal_ = _proposals[proposalId];

        // We only support Weighted voting right now
        require(
            proposal_.votingSystem == VotingSystem.Weighted,
            "Unsupported voting system"
        );

        // Check that proposal is active
        require(
            block.number >= proposal_.startBlockNumber,
            "Vote has not started"
        );
        require(block.number <= proposal_.endBlockNumber, "Vote has ended");

        // Check that options & weights & comments match, and weight sum == 100
        require(
            options.length == weights.length,
            "Mismatched options and weights length"
        );
        require(
            weights.length == comments.length,
            "Mismatched options and commentslength"
        );
        uint256 weightSum;
        uint256 i;
        for (; i < weights.length; ) {
            weightSum += weights[i];
            unchecked {
                ++i;
            }
        }
        require(weightSum == 100, "Incorrect weights");

        // Builds a query like:
        //
        // ```
        // UPDATE votes
        // SET weight = CASE option_id
        //                  WHEN X1 THEN Y1
        //                  WHEN X2 THEN Y2
        //                  ELSE 0
        //              END
        // WHERE lower(address) = lower(msg.sender);
        // ```
        string memory updateStatement = string.concat(
            "UPDATE ",
            _votesTable.name,
            " SET weight = CASE option_id"
        );

        uint256 votes = weights.length;
        i = 0;
        unchecked {
            for (; i < votes; ) {
                updateStatement = string.concat(
                    updateStatement,
                    " WHEN ",
                    Strings.toString(options[i]),
                    " THEN ",
                    Strings.toString(weights[i])
                );
                ++i;
            }
        }

        updateStatement = string.concat(
            updateStatement,
            " ELSE 0 END, comment = CASE option_id"
        );

        i = 0;
        unchecked {
            for (; i < votes; ) {
                updateStatement = string.concat(
                    updateStatement,
                    " WHEN ",
                    Strings.toString(options[i]),
                    " THEN ",
                    SQLHelpers.quote(comments[i])
                );
                ++i;
            }
        }

        updateStatement = string.concat(
            updateStatement,
            " ELSE null END WHERE lower(address) = lower('",
            Strings.toHexString(uint256(uint160(msg.sender)), 20),
            "') AND proposal_id = ",
            Strings.toString(proposalId)
        );

        // Submit vote
        TablelandDeployments.get().mutate(
            address(this),
            _votesTable.id,
            updateStatement
        );
    }

    /// @inheritdoc IVotingRegistry
    function distributeVoterRewards(uint256 proposalId) external {
        Proposal memory proposal_ = _proposals[proposalId];

        require(
            block.number > proposal_.endBlockNumber,
            "Vote has not ended yet"
        );

        require(!proposal_.rewardsDistributed, "Rewards have been distributed");

        _proposals[proposalId].rewardsDistributed = true;

        // Builds a query like:
        //
        // ```
        // INSERT INTO ft_rewards (block_num, recipient, reason, amount, vote_id)
        // SELECT DISTINCT
        //   BLOCK_NUM(),
        //   address,
        //   'participated in vote',
        //   amount,
        //   proposal_id
        // FROM votes WHERE weight > 0 and proposal_id = ?
        // ```
        string memory insert = string.concat(
            "INSERT INTO ",
            _ftRewardsTable.name,
            " (block_num, recipient, reason, amount, proposal_id)",
            " SELECT DISTINCT BLOCK_NUM(), ",
            "address, 'Voted on proposal', ",
            Strings.toString(proposal_.voterReward),
            ", proposal_id FROM ",
            _votesTable.name,
            " WHERE weight > 0 AND proposal_id = ",
            Strings.toString(proposalId)
        );

        TablelandDeployments.get().mutate(
            address(this),
            _ftRewardsTable.id,
            insert
        );
    }

    // =============================
    //        INTERNAL
    // =============================

    /// @dev Inserts a proposal into the proposals table.
    function _insertProposal(
        string memory proposalIdString,
        string memory name,
        string memory descriptionCid,
        VotingSystem votingSystem,
        uint256 voterFtReward,
        uint256 startBlockNumber,
        uint256 endBlockNumber
    ) internal {
        string memory insert = string.concat(
            "INSERT INTO ",
            _proposalsTable.name,
            " (id, name, description_cid, voting_system, voter_ft_reward, created_at, start_block, end_block) VALUES (",
            proposalIdString,
            ", ",
            SQLHelpers.quote(name),
            ", ",
            SQLHelpers.quote(descriptionCid),
            ", ",
            Strings.toString(uint(votingSystem)),
            ", ",
            Strings.toString(voterFtReward),
            ", ",
            Strings.toString(block.number),
            ", ",
            Strings.toString(startBlockNumber),
            ", ",
            Strings.toString(endBlockNumber),
            ")"
        );
        TablelandDeployments.get().mutate(
            address(this),
            _proposalsTable.id,
            insert
        );
    }

    /// @dev Inserts `options` into the options table for the given `proposalId`.
    function _insertOptions(
        string memory proposalId,
        string[] calldata options
    ) internal {
        string memory insert = string.concat(
            "INSERT INTO ",
            _optionsTable.name,
            " (proposal_id, id, description) VALUES"
        );

        uint256 length = options.length;
        string memory prefix;
        uint256 i;
        for (; i < length; ) {
            if (i == 0) {
                prefix = "(";
            } else {
                prefix = ",(";
            }

            insert = string.concat(
                insert,
                prefix,
                proposalId,
                ",",
                Strings.toString(i + 1),
                ",",
                SQLHelpers.quote(options[i]),
                ")"
            );

            unchecked {
                ++i;
            }
        }

        TablelandDeployments.get().mutate(
            address(this),
            _optionsTable.id,
            insert
        );
    }

    /// @dev Stores a snapshot of the all current ft balances in the snapshot table with the given `proposalId`.
    function _snapshotVotingPower(string memory proposalId) internal {
        string memory snapshotPilotSessionFt = string.concat(
            "INSERT INTO ",
            _ftSnapshotTable.name,
            " (address, ft, proposal_id) ",
            "SELECT owner, SUM(COALESCE(end_time, BLOCK_NUM()) - start_time), ",
            proposalId,
            " FROM ",
            _pilotSessionsTable.name,
            " GROUP BY owner"
        );

        string memory snapshotFtRewards = string.concat(
            "INSERT INTO ",
            _ftSnapshotTable.name,
            " (address, ft, proposal_id) ",
            "SELECT recipient, amount, ",
            proposalId,
            " FROM ",
            _ftRewardsTable.name,
            " ON CONFLICT (address, proposal_id) ",
            "DO UPDATE SET ft = ",
            _ftSnapshotTable.name,
            ".ft + excluded.ft"
        );

        ITablelandTables.Statement[]
            memory stmnts = new ITablelandTables.Statement[](2);
        stmnts[0] = ITablelandTables.Statement(
            _ftSnapshotTable.id,
            snapshotPilotSessionFt
        );
        stmnts[1] = ITablelandTables.Statement(
            _ftSnapshotTable.id,
            snapshotFtRewards
        );
        TablelandDeployments.get().mutate(address(this), stmnts);
    }

    /// @dev Inserts the cross product of `options` and all eligible voting addresses
    /// from the ft snapshot table for the given `proposalId`.
    function _insertEligibleVotes(
        string memory proposalId,
        string[] calldata options
    ) internal {
        uint256 length = options.length;
        ITablelandTables.Statement[]
            memory stmnts = new ITablelandTables.Statement[](length);

        uint256 i;
        unchecked {
            for (; i < length; ) {
                string memory insert = string.concat(
                    "INSERT INTO ",
                    _votesTable.name,
                    " (address, proposal_id, option_id, weight) ",
                    "SELECT DISTINCT address, ",
                    proposalId,
                    ", ",
                    Strings.toString(i + 1),
                    ", 0 FROM ",
                    _ftSnapshotTable.name
                );

                stmnts[i++] = ITablelandTables.Statement(
                    _votesTable.id,
                    insert
                );
            }
        }

        TablelandDeployments.get().mutate(address(this), stmnts);
    }
}
