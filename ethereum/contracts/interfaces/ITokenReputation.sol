// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

/**
 * @title A minimal ERC-721 extension for token-based reputation.
 */
interface ITokenReputation {
    /**
     * @notice Emitted when token staking is initiated.
     * @param tokenId Identifier for the token being staked.
     * @param owner The token owner who wants to stake the token.
     * @param block The block number at the time of staking.
     */
    event Stake(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 indexed block
    );

    /**
     * @notice Emitted when token unstaking is initiated.
     * @param tokenId Identifier for the token being unstaked.
     * @param owner The token owner who wants to unstake the token.
     * @param block The block number at the time of unstaking.
     */
    event Unstake(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 indexed block
    );

    /**
     * @notice Stake the token, disabling marketplace transfers.
     * @param tokenId The unique token identifier.
     */
    function stake(uint256 tokenId) external;

    /**
     * @notice Unstake the token, enabling marketplace transfers.
     * @param tokenId The unique token identifier.
     */
    function unstake(uint256 tokenId) external;
}
