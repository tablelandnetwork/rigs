// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

/**
 * @dev Interface of a TablelandRigs compliant contract.
 */
interface ITablelandRigs {
    // Thrown when minting with minting not open.
    error MintingClosed();

    // Thrown when minting with quantity of zero.
    error ZeroQuantity();

    // Thrownn when minting when mint quantity exceeds remaining allowance.
    error InsufficientAllowance();

    // Thrown when minting when an allowance proof is invalid.
    error InvalidProof();

    // Thrown when minting and mint txn value is too low.
    error InsufficientValue(uint256 price);

    // Thrown when minting when there are no more Rigs.
    error SoldOut();

    // Values describing mint phases.
    enum MintPhase {
        CLOSED,
        ALLOWLIST,
        WAITLIST,
        PUBLIC
    }

    /**
     * @dev Emitted when mint phase is changed.
     */
    event MintPhaseChanged(MintPhase mintPhase);

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
     * - quantity must not be zero
     * - contract mint phase must be `MintPhase.PUBLIC`
     */
    function mint(uint256 quantity) external payable;

    /**
     * @dev Mints Rigs from a whitelist.
     *
     * quantity - the number of Rigs to mint
     * freeAllowance - the number of free Rigs allocated to `msg.sender`
     * paidAllowance - the number of paid Rigs allocated to `msg.sender`
     * proof - merkle proof proving `msg.sender` has said `freeAllowance` and `paidAllowance`
     *
     * Requirements:
     *
     * - contract must be unpaused
     * - quantity must not be zero
     * - proof must be valid and correspond to `msg.sender`, `freeAllowance`, and `paidAllowance`
     * - contract mint phase must be `MintPhase.ALLOWLIST` or `MintPhase.WAITLIST`
     */
    function mint(
        uint256 quantity,
        uint256 freeAllowance,
        uint256 paidAllowance,
        bytes32[] calldata proof
    ) external payable;

    /**
     * @dev Returns allowlist and waitlist claims for `by` address.
     *
     * by - the address to retrieve claims for
     */
    function getClaimed(address by)
        external
        returns (uint16 allowClaims, uint16 waitClaims);

    /**
     * @dev Sets mint phase.
     *
     * mintPhase - the new mint phase to set
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     * - `mintPhase` must correspond to one of enum `MintPhase`
     */
    function setMintPhase(uint256 mintPhase) external;

    /**
     * @dev Sets mint phase beneficiary.
     *
     * beneficiary - the address to set as beneficiary
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     */
    function setBeneficiary(address payable beneficiary) external;

    /**
     * @dev Sets the token URI template.
     *
     * uriTemplate - the new URI template
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     */
    function setURITemplate(string[] memory uriTemplate) external;

    /**
     * @dev Returns contract URI for storefront-level metadata.
     */
    function contractURI() external returns (string memory);

    /**
     * @dev Sets the contract URI.
     *
     * uri - the new URI
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     */
    function setContractURI(string memory uri) external;

    /**
     * @dev Sets the royalty receiver for ERC2981.
     *
     * receiver - the royalty receiver address
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     * - `receiver` cannot be the zero address
     */
    function setRoyaltyReceiver(address receiver) external;

    /**
     * @dev Pauses minting.
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     * - contract must be unpaused
     */
    function pause() external;

    /**
     * @dev Unpauses minting.
     *
     * Requirements:
     *
     * - `msg.sender` must be contract owner
     * - contract must be paused
     */
    function unpause() external;
}
