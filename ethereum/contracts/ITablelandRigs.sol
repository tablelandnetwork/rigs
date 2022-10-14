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

    // Thrown when minting when mint quantity exceeds remaining allowance.
    error InsufficientAllowance();

    // Thrown when minting when an allowance proof is invalid.
    error InvalidProof();

    // Thrown when minting and mint txn value is too low.
    error InsufficientValue(uint256 price);

    // Thrown when minting when there are no more Rigs.
    error SoldOut();

    // Thrown when attempting to interact with non-owned Rigs or Pilot tokens.
    error Unauthorized();

    // Thrown if a Pilot's contract is not ERC721-compliant.
    error InvalidPilotContract(address pilotContract);

    // Thrown upon a batch pilot update error.
    error InvalidBatchPilotRig();

    // Thrown if a Rig tries to be piloted with an existing `Pilot`.
    error SpecifiedPilotIsActive(address pilotContract, uint256 pilotId);

    // Thrown when a Rig has is training or has already completed its training.
    error RigIsTrainingOrTrained(uint256 tokenId);

    // Thrown when a Rig is trying to be piloted but hasn't completed its training.
    error RigIsNotTrained(uint256 tokenId);

    // Thrown if there is an attempt to park a Rig that's already parked.
    error RigIsParked(uint256 tokenId);

    // Thrown if there is an attempt to transfer a Rig that's currently in-flight.
    error RigIsNotParked(uint256 tokenId);

    // Values describing mint phases.
    enum MintPhase {
        CLOSED,
        ALLOWLIST,
        WAITLIST,
        PUBLIC
    }

    // A Rig's pilot
    struct Pilot {
        // Index of the current pilot, for tracking the history of a Rig's pilots.
        uint16 index;
        // Keep track of the pilot's starting `block.number` for flight time tracking.
        uint64 startTime;
        // Address of the ERC721 pilot contract.
        address pilotContract;
        // TODO we have 160 + 64 + 16 = 240 bits in this tighly packed group, so room for 16 bits of extra data, if needed
        // Token ID of the ERC721 pilot.
        uint256 pilotId;
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

    // TODO check if making these `indexed` is worthwhile; it adds a little gas but makes em more easily queryable
    /**
     * @dev Emitted when a Rig starts its training.
     */
    event Training(uint256 tokenId);

    /**
     * @dev Emitted when a Rig is piloted.
     */
    event Piloted(uint256 tokenId);

    /**
     * @dev Emitted when a Rig is parked.
     */
    event Parked(uint256 tokenId);

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

    /**
     * @dev Retrieves pilot info for a Rig.
     *
     * tokenId - the unique Rig token identifier
     *
     * Requirements:
     *
     * - `tokenId` must exist
     */
    function pilotInfo(uint256 tokenId) external view returns (Pilot memory);

    /**
     * @dev Retrieves Rig status for piloted (`1`) or parked (`0`).
     *
     * tokenId - the unique Rig token identifier
     *
     * Requirements:
     *
     * - `tokenId` must exist
     */
    function rigStatus(uint256 tokenId) external view returns (uint8);

    /**
     * @dev Trains a Rig for a period of 30 days, putting it in flight.
     *
     * tokenId - the unique Rig token identifier
     *
     * Requirements:
     *
     * - `tokenId` must exist
     * - `msg.sender` must own the Rig
     * - `Pilot.index` must be `0` (untrained)
     */
    function trainRig(uint256 tokenId) external;

    /**
     * @dev Puts a single Rig in flight by setting a custom `Pilot`.
     *
     * tokenId - the unique Rig token identifier
     * pilotContract - ERC721 contract address of a desired Rig's pilot
     * pilotTokenId - the unique token identifier at the target `pilotContract`
     *
     * Requirements:
     *
     * - `tokenId` must exist
     * - `msg.sender` must own the Rig
     * - `Pilot.index` cannot be `0`; must haved completed training (see `parkRig`)
     * - `Pilot.startTime` must be `0` (parked)
     * - `pilotContract` must be an ERC721 contract; cannot be the Rigs contract
     * - `pilotTokenId` must be owned by `msg.sender` at `pilotContract`
     * - `Pilot` can only be associated with one Rig at a time; parks on conflict
     */
    function pilotRig(
        uint256 tokenId,
        address pilotContract,
        uint256 pilotTokenId
    ) external;

    /**
     * @dev Puts multiple Rigs in flight by setting a custom set of `Pilot`s.
     *
     * tokenIds - a list of unique Rig token identifiers
     * pilotContracts - a list of ERC721 contract addresses of a desired Rig's pilot
     * pilotTokenIds - a list of unique token identifiers at the target `pilotContract`
     *
     * Requirements:
     *
     * - All input parameters must be non-empty
     * - All input parameters must have an equal length
     * - There cannot exist a duplicate value in each of the individual parameters
     * - See `pilotRig` for additional constraints on a per-token basis.
     */
    function pilotRig(
        uint256[] memory tokenIds,
        address[] memory pilotContracts,
        uint256[] memory pilotTokenIds
    ) external;

    /**
     * @dev Parks a Rig and ends the current `Pilot` session.
     *
     * tokenId - the unique Rig token identifier
     *
     * Requirements:
     *
     * - `tokenId` must exist
     * - `msg.sender` must own the Rig, or is the Rigs contract (for calls from `pilotRig`)
     * - `Pilot.startTime` should not be zero (0 == parked)
     * - `Pilot` must have completed 30 days of training
     */
    function parkRig(uint256 tokenId) external;
}
