// SPDX-License-Identifier: MIT
pragma solidity >=0.8.10 <0.9.0;

/**
 * @dev Interface of a TablelandRigs compliant contract.
 */
interface ITablelandRigs {

    error ZeroQuantity();

    error InsufficientAllowance();

    error InvalidClaim();

    error InsufficientValue(uint256 price);

    error SoldOut();

    event ClaimsOpen();

    event MintsOpen();

    /**
     * @dev Emitted when a buyer is refunded.
     */
    event Refund(address indexed buyer, uint256 amount);

    /**
     * @dev Emitted on all purchases of non-zero amount.
     */
    event Revenue(
        address indexed beneficiary,
        uint256 numPurchased,
        uint256 amount
    );

    /**
     * @dev Mints Rigs.
     *
     * quantity - the number of Rigs to mint
     *
     * Requirements:
     *
     * - contract must be unpaused
     */
    function mint(uint256 quantity) external payable;

    /**
     * @dev Sets the contract URI template.
     *
     * uriTemplate - the new URI template
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     */
    function setURITemplate(string memory uriTemplate) external;

    /**
     * @dev Pauses the contract.
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     * - contract must be unpaused
     */
    function pause() external;

    /**
     * @dev Unpauses the contract.
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     * - contract must be paused
     */
    function unpause() external;
}
