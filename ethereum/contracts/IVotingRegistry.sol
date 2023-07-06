// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

interface IVotingRegistry {
    /// @dev Emitted when a proposal is created.
    event ProposalCreated(uint256 proposalId);

    /// @dev Struct that holds information about a proposal.
    struct Proposal {
        uint256 startBlockNumber;
        uint256 endBlockNumber;
        uint256 voterReward;
        string name;
        bool rewardsDistributed;
    }

    /// @notice Create a new proposal
    ///
    /// @param name             The name of the proposal
    /// @param descriptionCid   An IPFS CID to a markdown document with proposal details
    /// @param voterReward      The reputation reward amount voters get for voting
    /// @param startBlockNumber The block number when the proposal voting starts
    /// @param endBlockNumber   The block number when the proposal voting ends
    /// @param options          A list of options for the proposal
    function createProposal(
        string calldata name,
        string calldata descriptionCid,
        uint256 voterReward,
        uint256 startBlockNumber,
        uint256 endBlockNumber,
        string[] calldata options
    ) external returns (uint256 proposalId);

    /// @notice Get a proposal
    function proposal(
        uint256 proposalId
    ) external view returns (Proposal memory);

    /// @notice Cast a vote for a proposal. Might revert if the proposal hasn't opened yet or if it has ended.
    ///
    /// @param proposalId The proposal id
    /// @param options    The options the user wants to vote for
    /// @param weights    Weights for `options`
    /// @param comments   Comments for `options`
    function vote(
        uint256 proposalId,
        uint256[] calldata options,
        uint256[] calldata weights,
        string[] memory comments
    ) external;

    /// @notice Distribute rewards to voters for a proposal. Reverts if the proposal hasn't ended. Can only be called once.
    ///
    /// @param proposalId The proposal id.
    function distributeVoterRewards(uint256 proposalId) external;
}
