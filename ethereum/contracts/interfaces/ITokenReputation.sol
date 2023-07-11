// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

/**
 * @title A minimal ERC-721 extension for token-based reputation.
 */
interface ITokenReputation {
    /**
     * @notice Emitted when token staking is initiated.
     * @param tokenId Identifier for the token being staked.
     * @param operator The token owner/operator who wants to stake the token.
     */
    event Stake(uint256 indexed tokenId, address indexed operator);

    /**
     * @notice Emitted when token unstaking is initiated.
     * @param tokenId Identifier for the token being unstaked.
     * @param operator The token owner/operator who wants to unstake the token.
     */
    event Unstake(uint256 indexed tokenId, address indexed operator);

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
