// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "hardhat/console.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {TablelandDeployments} from "@tableland/evm/contracts/utils/TablelandDeployments.sol";
import {ITablelandTables} from "@tableland/evm/contracts/interfaces/ITablelandTables.sol";
import "@tableland/evm/contracts/utils/SQLHelpers.sol";

contract VotingRegistry is AccessControl {
    event ProposalCreated(uint256 proposalId);

    bytes32 public constant VOTING_ADMIN_ROLE = keccak256("VOTING_ADMIN_ROLE");

    struct Proposal {
        uint256 startBlockNumber;
        uint256 endBlockNumber;
        uint256 voterFtReward;
        string name;
        bool rewardsDistributed;
    }

    struct TableNames {
        string votesTableName;
        string alternativesTableName;
        string ftSnapshotTableName;
    }

    string private constant _PROPOSALS_PREFIX = "proposals";
    uint256 private _proposalsTableId;
    string private _proposalsTableName;

    string private constant _FT_SNAPSHOT_PREFIX = "ft_snapshot";
    uint256 private _ftSnapshotTableId;
    string private _ftSnapshotTableName;

    string private constant _VOTES_PREFIX = "votes";
    uint256 private _votesTableId;
    string private _votesTableName;

    string private constant _ALTERNATIVES_PREFIX = "alternatives";
    uint256 private _alternativesTableId;
    string private _alternativesTableName;

    string private _pilotSessionsTableName;
    string private _ftRewardsTableName;
    uint256 private _ftRewardsTableId;

    uint256 private proposalCounter;

    mapping(uint256 => Proposal) private _proposals;

    constructor(string memory pilotSessionsTableName, string memory ftRewardsTableName, uint256 ftRewardsTableId) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VOTING_ADMIN_ROLE, msg.sender);

        _pilotSessionsTableName = pilotSessionsTableName;
        _ftRewardsTableName = ftRewardsTableName;
        _ftRewardsTableId = ftRewardsTableId;

        _proposalsTableId = _createProposalsTable();
        _proposalsTableName = SQLHelpers.toNameFromId(_PROPOSALS_PREFIX, _proposalsTableId);

        _ftSnapshotTableId = _createSnapshotTable();
        _ftSnapshotTableName = SQLHelpers.toNameFromId(_FT_SNAPSHOT_PREFIX, _ftSnapshotTableId);

        _votesTableId = _createVotesTable();
        _votesTableName = SQLHelpers.toNameFromId(_VOTES_PREFIX, _votesTableId);

        _alternativesTableId = _createAlternativesTable();
        _alternativesTableName = SQLHelpers.toNameFromId(_ALTERNATIVES_PREFIX, _alternativesTableId);
    }

    function tableNames() external view returns (TableNames memory) {
        return TableNames(_votesTableName, _alternativesTableName, _ftSnapshotTableName);
    }

    function createProposal(
        string[] calldata alternatives,
        string calldata name,
        uint256 voterFtReward,
        uint256 startBlockNumber,
        uint256 endBlockNumber
    ) external onlyRole(VOTING_ADMIN_ROLE) returns (uint256 proposalId) {
        proposalId = proposalCounter++;

        string memory proposalIdString = Strings.toString(proposalId);

        _insertProposal(proposalIdString, name, voterFtReward, startBlockNumber, endBlockNumber);
        _insertAlternatives(proposalIdString, alternatives);
        _snapshotVotingPower(proposalIdString);
        _insertEligibleVotes(proposalIdString, alternatives);

        _proposals[proposalId] = Proposal(startBlockNumber, endBlockNumber, voterFtReward, name, false);

        emit ProposalCreated(proposalId);

        return proposalId;
    }

    function proposal(uint256 proposalId) external view returns (Proposal memory) {
        return _proposals[proposalId];
    }

    function _createProposalsTable() internal returns (uint256) {
        return TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "id integer NOT NULL, name text NOT NULL, voter_ft_reward integer NOT NULL, created_at integer NOT NULL, start_block integer NOT NULL, end_block integer NOT NULL",
                _PROPOSALS_PREFIX
            )
        );
    }

    function _createSnapshotTable() internal returns (uint256) {
        return TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "address text NOT NULL, ft integer NOT NULL, proposal_id integer NOT NULL", _FT_SNAPSHOT_PREFIX
            )
        );
    }

    function _createVotesTable() internal returns (uint256) {
        return TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "address text NOT NULL, proposal_id integer NOT NULL, alternative_id integer NOT NULL, weight integer NOT NULL, UNIQUE(address, alternative_id, proposal_id)",
                _VOTES_PREFIX
            )
        );
    }

    function _createAlternativesTable() internal returns (uint256) {
        return TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "id integer NOT NULL, proposal_id integer NOT NULL, description text NOT NULL", _ALTERNATIVES_PREFIX
            )
        );
    }

    function _insertProposal(
        string memory proposalIdString,
        string memory name,
        uint256 voterFtReward,
        uint256 startBlockNumber,
        uint256 endBlockNumber
    ) internal {
        string memory insert = string.concat(
            "INSERT INTO ",
            _proposalsTableName,
            " (id, name, voter_ft_reward, created_at, start_block, end_block) VALUES (",
            proposalIdString,
            ", ",
            SQLHelpers.quote(name),
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
        TablelandDeployments.get().mutate(address(this), _proposalsTableId, insert);
    }

    function _insertAlternatives(string memory proposalId, string[] calldata alternatives) internal {
        uint256 length = alternatives.length;

        string[] memory values = new string[](length);
        uint256 i;
        unchecked {
            for (; i < length;) {
                values[i] = string.concat(proposalId, ", ", Strings.toString(i + 1), ", '", alternatives[i], "'");
                i++;
            }
        }

        string memory insert =
            SQLHelpers.toBatchInsert(_ALTERNATIVES_PREFIX, _alternativesTableId, "proposal_id, id, description", values);

        TablelandDeployments.get().mutate(address(this), _alternativesTableId, insert);
    }

    function _snapshotVotingPower(string memory proposalId) internal {
        string memory snapshotPilotSessionFt = string.concat(
            "INSERT INTO ",
            _ftSnapshotTableName,
            " (address, ft, proposal_id) ",
            "SELECT owner, (COALESCE(end_time, BLOCK_NUM()) - start_time), ",
            proposalId,
            " FROM ",
            _pilotSessionsTableName
        );

        string memory snapshotFtRewards = string.concat(
            "INSERT INTO ",
            _ftSnapshotTableName,
            " (address, ft, proposal_id) ",
            "SELECT recipient, amount, ",
            proposalId,
            " FROM ",
            _ftRewardsTableName
        );

        ITablelandTables.Statement[] memory stmnts = new ITablelandTables.Statement[](2);
        stmnts[0] = ITablelandTables.Statement(_ftSnapshotTableId, snapshotPilotSessionFt);
        stmnts[1] = ITablelandTables.Statement(_ftSnapshotTableId, snapshotFtRewards);
        TablelandDeployments.get().mutate(address(this), stmnts);
    }

    function _insertEligibleVotes(string memory proposalId, string[] calldata alternatives) internal {
        uint256 length = alternatives.length;
        ITablelandTables.Statement[] memory stmnts = new ITablelandTables.Statement[](length);

        uint256 i;
        unchecked {
            for (; i < length;) {
                string memory insert = string.concat(
                    "INSERT INTO ",
                    _votesTableName,
                    " (address, proposal_id, alternative_id, weight) ",
                    "SELECT DISTINCT address, ",
                    proposalId,
                    ", ",
                    Strings.toString(i + 1),
                    ", 0 FROM ",
                    _ftSnapshotTableName
                );

                stmnts[i++] = ITablelandTables.Statement(_votesTableId, insert);
            }
        }

        TablelandDeployments.get().mutate(address(this), stmnts);
    }

    function vote(uint256 proposalId, uint256[] calldata alternatives, uint256[] calldata weights) external {
        Proposal memory proposal = _proposals[proposalId];

        // Check that proposal is active
        require(block.number >= proposal.startBlockNumber, "Vote has not started");
        require(block.number <= proposal.endBlockNumber, "Vote has ended");

        // Check that alternatives & weights match, and weight sum == 100
        require(alternatives.length == weights.length, "Mismatched alternatives and weights length");
        uint256 weightSum;
        uint256 i;
        for (; i < weights.length;) {
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
        // SET weight = CASE alternative_id
        //                  WHEN X1 THEN Y1
        //                  WHEN X2 THEN Y2
        //                  ELSE 0
        //              END
        // WHERE lower(address) = lower(msg.sender);
        // ```
        string memory updateStatement = string.concat("UPDATE ", _votesTableName, " SET weight = CASE alternative_id");

        i = 0;
        unchecked {
            for (; i < weights.length;) {
                updateStatement = string.concat(
                    updateStatement, " WHEN ", Strings.toString(alternatives[i]), " THEN ", Strings.toString(weights[i])
                );
                ++i;
            }
        }

        updateStatement = string.concat(
            updateStatement,
            " ELSE 0 END WHERE lower(address) = lower('",
            Strings.toHexString(uint256(uint160(msg.sender)), 20),
            "') AND proposal_id = ",
            Strings.toString(proposalId)
        );

        // Submit vote
        TablelandDeployments.get().mutate(address(this), _votesTableId, updateStatement);
    }

    function distributeParticipantFtRewards(uint256 proposalId) external {
        Proposal memory proposal = _proposals[proposalId];

        require(block.number > proposal.endBlockNumber, "Vote has not ended yet");

        require(!proposal.rewardsDistributed, "Rewards have been distributed");

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
            _ftRewardsTableName,
            " (block_num, recipient, reason, amount, proposal_id)",
            " SELECT DISTINCT BLOCK_NUM(), ",
            "address, 'Voted on proposal', ",
            Strings.toString(proposal.voterFtReward),
            ", proposal_id FROM ",
            _votesTableName,
            " WHERE weight > 0 AND proposal_id = ",
            Strings.toString(proposalId)
        );

        TablelandDeployments.get().mutate(address(this), _ftRewardsTableId, insert);
    }

    function onERC721Received(address, address, uint256, bytes calldata) public pure returns (bytes4) {
        return 0x150b7a02;
    }
}
