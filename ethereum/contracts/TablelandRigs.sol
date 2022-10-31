// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@tableland/evm/contracts/utils/SQLHelpers.sol";
import "@tableland/evm/contracts/utils/TablelandDeployments.sol";
import "./utils/URITemplate.sol";
import "./ITablelandRigs.sol";

/**
 * @dev Implementation of {ITablelandRigs}.
 */
contract TablelandRigs is
    ITablelandRigs,
    URITemplate,
    ERC721AUpgradeable,
    ERC721AQueryableUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC2981Upgradeable,
    UUPSUpgradeable
{
    // Table prefix for the Rigs pilot sessions table.
    string private constant PILOT_SESSIONS_PREFIX = "pilot_sessions";

    // Mask of the lower 64 bits of a pilot; the flight start time
    uint256 private constant _BITMASK_START_TIME = (1 << 64) - 1;

    // Mask of all pilot bits, except the start time
    uint256 private constant _BITMASK_START_TIME_COMPLEMENT =
        _BITMASK_START_TIME ^ type(uint256).max;

    // Bit position of the pilot ID
    uint256 private constant _BITPOS_PILOT_ID = 64;

    // Bit position of the pilot contract
    uint256 private constant _BITPOS_PILOT_CONTRACT = 96;

    // The maximum number of tokens that can be minted.
    uint256 public maxSupply;

    // The price of minting a token.
    uint256 public mintPrice;

    // The address receiving mint revenue.
    address payable public beneficiary;

    // The allowClaims merkletree root.
    bytes32 public allowlistRoot;

    // The waitClaims merkletree root.
    bytes32 public waitlistRoot;

    // Flag specifying whether or not claims
    MintPhase public mintPhase;

    // URI for contract info.
    string private _contractInfoURI;

    // Table ID for the Rigs pilot sessions table.
    uint256 private _pilotSessionsTableId;

    // A Rig's pilot.
    //
    // Bits layout:
    // - [0..63]    `startTime` - starting block number of pilot's flight time
    // - [64..95]   `pilotId` - ERC-721 token ID of the pilot at `pilotContract`
    // - [96..255]  `pilotContract` - address of the ERC-721 contract for the pilot
    uint256 _packedPilot;
    // Tracks the Rig `tokenId` to its current `_packedPilot`.
    mapping(uint16 => uint256) internal _pilots;

    // Tracks the packed "pilot data" (pilot contract and pilot ID) to the Rig `tokenId`.
    // Used to help check if a custom pilot is in use.
    mapping(uint192 => uint16) internal _pilotIndex;

    function initialize(
        uint256 _maxSupply,
        uint256 _mintPrice,
        address payable _beneficiary,
        address payable royaltyReceiver,
        bytes32 _allowlistRoot,
        bytes32 _waitlistRoot
    ) public initializerERC721A initializer {
        __ERC721A_init("Tableland Rigs", "RIG");
        __ERC721AQueryable_init();
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __ERC2981_init();
        __UUPSUpgradeable_init();

        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        setBeneficiary(_beneficiary);
        _setDefaultRoyalty(royaltyReceiver, 500);
        allowlistRoot = _allowlistRoot;
        waitlistRoot = _waitlistRoot;
        mintPhase = MintPhase.CLOSED;
    }

    // =============================
    //        ITABLELANDRIGS
    // =============================

    /**
     * @dev See {ITablelandRigs-mint}.
     */
    function mint(uint256 quantity) external payable override whenNotPaused {
        bytes32[] memory proof;
        _verifyMint(quantity, 0, 0, proof);
    }

    /**
     * @dev See {ITablelandRigs-mint}.
     */
    function mint(
        uint256 quantity,
        uint256 freeAllowance,
        uint256 paidAllowance,
        bytes32[] calldata proof
    ) external payable override whenNotPaused {
        _verifyMint(quantity, freeAllowance, paidAllowance, proof);
    }

    /**
     * @dev Verifies mint against current mint phase.
     *
     * quantity - the number of Rigs to mint
     * freeAllowance - the number of free Rigs allocated to `msg.sender`
     * paidAllowance - the number of paid Rigs allocated to `msg.sender`
     * proof - merkle proof proving `msg.sender` has said `freeAllowance` and `paidAllowance`
     *
     * Requirements:
     *
     * - `mintPhase` must not be `CLOSED`
     * - quantity must not be zero
     * - current supply must be less than `maxSupply`
     * - if `mintPhase` is `ALLOWLIST` or `WAITLIST`, proof must be valid for `msg.sender`, `freeAllowance`, and `paidAllowance`
     * - if `mintPhase` is `ALLOWLIST` or `WAITLIST`, `msg.sender` must have sufficient unused allowance
     */
    function _verifyMint(
        uint256 quantity,
        uint256 freeAllowance,
        uint256 paidAllowance,
        bytes32[] memory proof
    ) private {
        // Ensure mint phase is not closed
        if (mintPhase == MintPhase.CLOSED) revert MintingClosed();

        // Check quantity is non-zero
        if (quantity == 0) revert ZeroQuantity();

        // Check quantity doesn't exceed remaining quota
        quantity = MathUpgradeable.min(quantity, maxSupply - totalSupply());
        if (quantity == 0) revert SoldOut();

        if (mintPhase == MintPhase.PUBLIC) {
            _mint(quantity, quantity);
        } else {
            // Get merkletree root for mint phase
            bytes32 root = mintPhase == MintPhase.ALLOWLIST
                ? allowlistRoot
                : waitlistRoot;

            // Verify proof against mint phase root
            if (
                !_verifyProof(
                    proof,
                    root,
                    _getLeaf(_msgSenderERC721A(), freeAllowance, paidAllowance)
                )
            ) revert InvalidProof();

            // Ensure allowance available
            uint16 allowClaims;
            uint16 waitClaims;
            (allowClaims, waitClaims) = getClaimed(_msgSenderERC721A());
            uint256 claimed = mintPhase == MintPhase.ALLOWLIST
                ? allowClaims
                : waitClaims;
            quantity = MathUpgradeable.min(
                quantity,
                freeAllowance + paidAllowance - claimed
            );
            if (
                quantity == 0 ||
                // Disallow claims from waitlist if already claimed on allowlist
                (mintPhase == MintPhase.WAITLIST && allowClaims > 0)
            ) revert InsufficientAllowance();

            // Get quantity that must be paid for
            uint256 freeSurplus = freeAllowance > claimed
                ? freeAllowance - claimed
                : 0;
            uint256 costQuantity = quantity < freeSurplus
                ? 0
                : quantity - freeSurplus;

            // Update allowance claimed
            claimed = claimed + quantity;
            if (mintPhase == MintPhase.ALLOWLIST) allowClaims = uint16(claimed);
            else waitClaims = uint16(claimed);
            _setClaimed(_msgSenderERC721A(), allowClaims, waitClaims);

            _mint(quantity, costQuantity);

            // Sanity check for tests
            assert(claimed <= freeAllowance + paidAllowance);
        }
    }

    /**
     * @dev Returns merkletree leaf node for given params.
     *
     * account - address for leaf
     * freeAllowance - free allowance for leaf
     * paidAllowance - paid allowance for leaf
     */
    function _getLeaf(
        address account,
        uint256 freeAllowance,
        uint256 paidAllowance
    ) internal pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(account, freeAllowance, paidAllowance));
    }

    /**
     * @dev Verifies that `proof` is a valid path to `leaf` in `root`.
     *
     * proof - merkle proof proving `msg.sender` has said `freeAllowance` and `paidAllowance`
     * root - merkletree root to verify against
     * leaf - leaf node that must exist in `root` via `proof`
     */
    function _verifyProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        return MerkleProofUpgradeable.verify(proof, root, leaf);
    }

    /**
     * @dev Mints Rigs and send revenue to `beneficiary`, refunding surplus to `msg.sender`.
     *
     * Borrows logic from https://github.com/divergencetech/ethier/blob/main/contracts/sales/Seller.sol.
     *
     * quantity - the number of Rigs to mint
     * costQuantity - the number of Rigs that must be paid for
     *
     * Requirements:
     *
     * - `msg.value` must be greater than or equal to `costQuantity`
     */
    function _mint(uint256 quantity, uint256 costQuantity)
        private
        nonReentrant
    {
        // Check sufficient value
        uint256 cost = _cost(costQuantity);
        if (msg.value < cost) revert InsufficientValue(cost);

        // Mint effect and interaction
        _safeMint(_msgSenderERC721A(), quantity);

        // Handle funds
        if (cost > 0) {
            AddressUpgradeable.sendValue(beneficiary, cost);
            emit Revenue(beneficiary, costQuantity, cost);
        }
        if (msg.value > cost) {
            address payable reimburse = payable(_msgSenderERC721A());
            uint256 refund = msg.value - cost;
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, bytes memory returnData) = reimburse.call{
                value: refund
            }("");
            require(success, string(returnData));
            emit Refund(reimburse, refund);
        }
    }

    /**
     * @dev Returns mint cost for `quantity`.
     *
     * quantity - number of Rigs to calculate cost for
     */
    function _cost(uint256 quantity) private view returns (uint256) {
        return quantity * mintPrice;
    }

    /**
     * @dev See {ITablelandRigs-getClaimed}.
     */
    function getClaimed(address by)
        public
        view
        returns (uint16 allowClaims, uint16 waitClaims)
    {
        uint64 packed = _getAux(by);
        allowClaims = uint16(packed);
        waitClaims = uint16(packed >> 16);
    }

    /**
     * @dev Sets allowlist and waitlist claims for `by` address.
     */
    function _setClaimed(
        address by,
        uint16 allowClaims,
        uint16 waitClaims
    ) private {
        _setAux(by, (uint64(waitClaims) << 16) | uint64(allowClaims));
    }

    /**
     * @dev See {ITablelandRigs-setMintPhase}.
     */
    function setMintPhase(uint256 _mintPhase) external override onlyOwner {
        mintPhase = MintPhase(_mintPhase);
        emit MintPhaseChanged(mintPhase);
    }

    /**
     * @dev See {ITablelandRigs-setBeneficiary}.
     */
    function setBeneficiary(address payable _beneficiary)
        public
        override
        onlyOwner
    {
        beneficiary = _beneficiary;
    }

    /**
     * @dev See {ITablelandRigs-setURITemplate}.
     */
    function setURITemplate(string[] memory uriTemplate)
        external
        override
        onlyOwner
    {
        _setURITemplate(uriTemplate);
    }

    /**
     * @dev See {ITablelandRigs-contractURI}.
     */
    function contractURI() public view override returns (string memory) {
        return _contractInfoURI;
    }

    /**
     * @dev See {ITablelandRigs-setContractURI}.
     */
    function setContractURI(string memory uri) external override onlyOwner {
        _contractInfoURI = uri;
    }

    /**
     * @dev See {ITablelandRigs-setRoyaltyReceiver}.
     */
    function setRoyaltyReceiver(address receiver) external onlyOwner {
        _setDefaultRoyalty(receiver, 500);
    }

    /**
     * @dev See {ITablelandRigs-pause}.
     */
    function pause() external override onlyOwner {
        _pause();
    }

    /**
     * @dev See {ITablelandRigs-unpause}.
     */
    function unpause() external override onlyOwner {
        _unpause();
    }

    /**
     * @dev See {ITablelandRigs-initPilots}.
     */
    function initPilots() external onlyOwner {
        _createPilotSessionsTable();
    }

    /**
     * @dev Creates the pilot sessions table.
     */
    function _createPilotSessionsTable() internal {
        _pilotSessionsTableId = TablelandDeployments.get().createTable(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "id integer primary key,rig_id integer not null,owner text not null,pilot_contract text,pilot_id integer,start_time integer not null,end_time integer",
                PILOT_SESSIONS_PREFIX
            )
        );
    }

    /**
     * @dev See {ITablelandRigs-pilotSessionsTable}.
     */
    function pilotSessionsTable() external view returns (string memory) {
        return
            SQLHelpers.toNameFromId(
                PILOT_SESSIONS_PREFIX,
                _pilotSessionsTableId
            );
    }

    /**
     * @dev See {ITablelandRigs-pilotInfo}.
     */
    function pilotInfo(uint256 tokenId) public view returns (Pilot memory) {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        (
            uint64 startTime,
            uint32 pilotId,
            uint160 pilotContract
        ) = _unpackedPilotInfo(uint16(tokenId));
        return Pilot(startTime, pilotId, address(pilotContract));
    }

    /**
     * @dev Returns all of the unpacked `_packedPilot` info from `_pilots` at Rig token ID.
     *
     * tokenId - the unique Rig token identifier
     */
    function _unpackedPilotInfo(uint16 tokenId)
        internal
        view
        returns (
            uint64,
            uint32,
            uint160
        )
    {
        return (
            uint64(_pilots[tokenId]),
            uint32(_pilots[tokenId] >> _BITPOS_PILOT_ID),
            uint160(_pilots[tokenId] >> _BITPOS_PILOT_CONTRACT)
        );
    }

    /**
     * @dev Returns the pilot's start time from `_packedPilot`
     *
     * tokenId - the unique Rig token identifier
     */
    function _startTime(uint16 tokenId) internal view returns (uint64) {
        return uint64(_pilots[tokenId]);
    }

    /**
     * @dev Returns the pilot data (packed `uint32` pilot ID and `uint160` pilot contract) from `_packedPilot`
     *
     * tokenId - the unique Rig token identifier
     */
    function _pilotData(uint16 tokenId) internal view returns (uint192) {
        return uint192(_pilots[tokenId] >> _BITPOS_PILOT_ID);
    }

    /**
     * @dev Sets the pilot's start time in `_packedPilot`
     *
     * tokenId - the unique Rig token identifier
     * startTime - the starting block number when putting a Rig into flight
     */
    function _setStartTime(uint16 tokenId, uint64 startTime) internal virtual {
        uint256 pilot = _pilots[tokenId];
        uint256 startTimeCasted;
        // Cast `startTime` with assembly to avoid redundant masking
        assembly {
            startTimeCasted := startTime
        }
        // Set the pilot, using the complement to mask all bits, except the start time
        // If the provided start time is zero, the mask already sets it to zero
        if (startTimeCasted == 0) {
            pilot = pilot & _BITMASK_START_TIME_COMPLEMENT;
        } else {
            pilot = (pilot & _BITMASK_START_TIME_COMPLEMENT) | startTimeCasted;
        }
        _pilots[tokenId] = pilot;
    }

    /**
     * @dev Sets the "pilot data" (both the pilot ID and pilot contract) in `_packedPilot`
     *
     * tokenId - the unique Rig token identifier
     * pilotId - the unique token identifier at the target `pilotContract`
     * pilotContract - ERC-721 contract address of a desired Rig's pilot
     */
    function _setPilotData(
        uint16 tokenId,
        uint32 pilotId,
        uint160 pilotContract
    ) internal virtual {
        uint256 pilot = _pilots[tokenId];
        uint256 pilotIdCasted;
        uint256 pilotContractCasted;
        // Cast "pilot data" (pilot contract and pilot ID) with assembly to avoid redundant masking
        assembly {
            pilotIdCasted := pilotId
            pilotContractCasted := pilotContract
        }
        // Set the pilot by first masking the start time
        pilot =
            (pilot & _BITMASK_START_TIME) |
            (pilotIdCasted << _BITPOS_PILOT_ID) |
            (pilotContractCasted << _BITPOS_PILOT_CONTRACT);
        _pilots[tokenId] = pilot;
    }

    /**
     * @dev Returns the current Garage status of a Rig.
     *
     * tokenId - the unique Rig token identifier
     */
    function _pilotStatus(uint16 tokenId) private view returns (GarageStatus) {
        if (_startTime(tokenId) == 0) {
            if (_pilotData(tokenId) == 0) return GarageStatus.UNTRAINED;
            // The `park` logic sets "pilot data" (pilot ID and pilot contract) to `0` if both of these are true:
            //   - pilot data is currently `1` (contract is zero and trainer pilot is in use, `1`)
            //   - Rig has not been training for long enough
            // i.e., `park` results in a status of `UNTRAINED` or `PARKED`
            else return GarageStatus.PARKED;
        } else {
            // Invariant: pilot data cannot be `0` if `startTime` is > `0`
            if (_pilotData(tokenId) == 1) return GarageStatus.TRAINING;
            else return GarageStatus.PILOTED;
        }
    }

    /**
     * @dev Returns whether or not a Rig can be piloted.
     *
     * tokenId - the unique Rig token identifier
     */
    function _canPilot(uint256 tokenId) private view returns (bool) {
        // Invariant: Cannot switch real pilots mid-flight, but can go from trainer -> real pilot
        // There are two ways to pilot:
        //   1. In a `PARKED` status
        //   2. In a `TRAINING` status for long enough (30 days; 172800 blocks)
        if (_startTime(uint16(tokenId)) == 0) {
            // Rig is either `UNTRAINED` or `PARKED`
            // It's not possible to pilot from `UNTRAINED`
            return _pilotData(uint16(tokenId)) != 0; // Could be a trainer (`1`) or real pilot
        } else if (_pilotData(uint16(tokenId)) == 1) {
            return block.number >= _startTime(uint16(tokenId)) + 172800; // Check training time completed
        } else return false;
    }

    /**
     * @dev See {ITablelandRigs-trainRig}.
     */
    function trainRig(uint256 tokenId) external {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to train the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A()) revert Unauthorized();
        // Validate the Rig is untrained
        if (_pilotStatus(uint16(tokenId)) != GarageStatus.UNTRAINED)
            revert InvalidPilotStatus();
        // Assign a trainer pilot to the Rig (the "pilot data" value: pilot ID is `1`, and pilot contract is `0`)
        _setStartTime(uint16(tokenId), uint64(block.number));
        _setPilotData(uint16(tokenId), 1, 0);
        // Insert the Rig training session into the Tableland pilot sessions table
        TablelandDeployments.get().runSQL(
            address(this),
            _pilotSessionsTableId,
            SQLHelpers.toInsert(
                PILOT_SESSIONS_PREFIX,
                _pilotSessionsTableId,
                "rig_id,owner,start_time",
                string.concat(
                    StringsUpgradeable.toString(uint16(tokenId)),
                    ",",
                    SQLHelpers.quote(
                        StringsUpgradeable.toHexString(ownerOf(tokenId))
                    ),
                    ",",
                    StringsUpgradeable.toString(uint64(block.number))
                )
            )
        );
        emit Training(tokenId);
    }

    using ERC165Checker for address;

    /**
     * @dev See {ITablelandRigs-pilotRig}.
     */
    function pilotRig(
        uint256 tokenId,
        uint256 pilotId,
        address pilotContract
    ) public {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to pilot the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A()) revert Unauthorized();
        // Validate the Rig can be piloted; `_canPilot` includes a check for training completion
        if (!_canPilot(tokenId)) revert InvalidPilotStatus();
        // Check if `pilotContract` is an ERC-721; cannot be the Rigs contract
        if (
            pilotContract == address(this) ||
            !pilotContract.supportsInterface(type(IERC721).interfaceId)
        ) revert InvalidCustomPilot();
        // Check ownership of `pilotId` at target `pilotContract`
        if (IERC721(pilotContract).ownerOf(pilotId) != _msgSenderERC721A())
            revert InvalidCustomPilot();
        // Verify the `pilotId` fits into a `uint32` (required for packing)
        if (pilotId > type(uint32).max) revert InvalidCustomPilot();
        // Initialize the packed "pilot data" (pilot contract and pilot ID)
        uint192 pilot = (uint192(pilotId) |
            (uint192(uint160(pilotContract)) << 32));
        // Verify if a pilot is already in use, by checking:
        // 1. Has the custom pilot been used before
        // 2. Was the pilot most recently used by a *different* Rig
        // 3. Is the other Rig in-flight (not `PARKED`)
        // If a different, in-flight Rig is using this pilot, park the other Rig
        if (
            _pilotIndex[pilot] != 0 &&
            _pilotIndex[pilot] != tokenId &&
            _pilotStatus(_pilotIndex[pilot]) != GarageStatus.PARKED
        ) parkRig(_pilotIndex[pilot]);
        // If the Rig is in-flight while still using its trainer pilot, update its session (no parking required)
        // Pilot has completed training at this point (training validation is defined in `_canPilot`, above)
        if (_pilotStatus(uint16(tokenId)) == GarageStatus.TRAINING) {
            // Update the pilot's existing session with its new pilot data
            string memory filters = string.concat(
                "rig_id=",
                StringsUpgradeable.toString(uint16(tokenId)),
                " and ",
                "start_time=",
                StringsUpgradeable.toString(_startTime(uint16(tokenId)))
            );
            string memory setters = string.concat(
                "pilot_contract=",
                SQLHelpers.quote(StringsUpgradeable.toHexString(pilotContract)),
                "pilot_id=",
                StringsUpgradeable.toString(uint32(pilotId))
            );
            TablelandDeployments.get().runSQL(
                address(this),
                _pilotSessionsTableId,
                SQLHelpers.toUpdate(
                    PILOT_SESSIONS_PREFIX,
                    _pilotSessionsTableId,
                    setters,
                    filters
                )
            );
        } else {
            // The Rig is `PARKED`; set the start time for the new pilot session
            _setStartTime(uint16(tokenId), uint64(block.number));
            // Insert the pilot into the Tableland pilot sessions table
            TablelandDeployments.get().runSQL(
                address(this),
                _pilotSessionsTableId,
                SQLHelpers.toInsert(
                    PILOT_SESSIONS_PREFIX,
                    _pilotSessionsTableId,
                    "rig_id,owner,pilot_contract,pilot_id,start_time",
                    string.concat(
                        StringsUpgradeable.toString(uint16(tokenId)),
                        ",",
                        SQLHelpers.quote(
                            StringsUpgradeable.toHexString(ownerOf(tokenId))
                        ),
                        ",",
                        SQLHelpers.quote(Strings.toHexString(pilotContract)),
                        ",",
                        StringsUpgradeable.toString(uint32(pilotId)),
                        ",",
                        StringsUpgradeable.toString(uint64(block.number))
                    )
                )
            );
        }
        // Avoid overwriting existing pilot if data is unchanged (i.e., if most recent pilot is the same as the one specified)
        if (_pilotData(uint16(tokenId)) != pilot) {
            _setPilotData(
                uint16(tokenId),
                uint32(pilotId),
                uint160(pilotContract)
            );
            _pilotIndex[pilot] = uint16(tokenId);
        }
        emit Piloted(tokenId);
    }

    /**
     * @dev See {ITablelandRigs-batchPilotRigs}.
     */
    function pilotRig(
        uint256[] calldata tokenIds,
        uint256[] calldata pilotIds,
        address[] calldata pilotContracts
    ) external {
        // Ensure the arrays are non-empty
        if (
            tokenIds.length == 0 ||
            pilotContracts.length == 0 ||
            pilotIds.length == 0
        ) revert InvalidBatchPilotRig();
        // Ensure there is a 1:1 relationship between Rig `tokenIds` and pilots
        // Only allow a batch to be an arbitrary max length of 255
        // Clients should restrict this further (e.g., <=5) to avoid gas exceeding limits
        if (
            tokenIds.length != pilotContracts.length ||
            tokenIds.length != pilotIds.length ||
            tokenIds.length > type(uint8).max
        ) revert InvalidBatchPilotRig();
        // For each token, call `pilotRig`
        for (uint8 i = 0; i < tokenIds.length; i++) {
            pilotRig(tokenIds[i], pilotIds[i], pilotContracts[i]);
        }
    }

    /**
     * @dev See {ITablelandRigs-parkRig}.
     */
    function parkRig(uint256 tokenId) public {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to park the specified Rig
        if (
            !(ownerOf(tokenId) == _msgSenderERC721A() ||
                address(this) == _msgSenderERC721A())
        ) revert Unauthorized();
        // Ensure Rig is currently in-flight
        if (
            !(_pilotStatus(uint16(tokenId)) == GarageStatus.TRAINING ||
                _pilotStatus(uint16(tokenId)) == GarageStatus.PILOTED)
        ) revert InvalidPilotStatus();
        // Only update the row with the matching `rig_id` and `start_time`
        uint64 startTime = _startTime(uint16(tokenId));
        string memory filters = string.concat(
            "rig_id=",
            StringsUpgradeable.toString(uint16(tokenId)),
            " and ",
            "start_time=",
            StringsUpgradeable.toString(startTime)
        );
        // Session update type is dependent on training completion status
        string memory setters;
        // Check if training is complete; must elapse without parking
        if (
            _pilotStatus(uint16(tokenId)) == GarageStatus.TRAINING &&
            !(block.number >= startTime + 172800)
        ) {
            // Pilot training is incomplete; reset the training pilot such that the Rig must train again
            _setPilotData(uint16(tokenId), 0, 0);
            // Update the row in pilot sessions table with its `end_time` equal to the `start_time` (no flight time)
            setters = string.concat(
                "end_time=",
                StringsUpgradeable.toString(startTime)
            );
        } else {
            // Training is complete; update the row in the pilot sessions table with its `end_time`
            setters = string.concat(
                "end_time=(",
                StringsUpgradeable.toString(uint64(block.number)),
                "-",
                StringsUpgradeable.toString(startTime),
                ")"
            );
        }
        // Set the `startTime` to `0` to indicate the Rig is now parked
        _setStartTime(uint16(tokenId), 0);
        // Update the pilot information in the Tableland pilot sessions table
        TablelandDeployments.get().runSQL(
            address(this),
            _pilotSessionsTableId,
            SQLHelpers.toUpdate(
                PILOT_SESSIONS_PREFIX,
                _pilotSessionsTableId,
                setters,
                filters
            )
        );
        emit Parked(tokenId);
    }

    // =============================
    //            ERC721A
    // =============================

    /**
     * @dev See {ERC721A-_startTokenId}.
     */
    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        return _getTokenURI(_toString(tokenId));
    }

    /**
     * @dev See {ERC721A-_beforeTokenTransfers}.
     */
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override {
        _requireNotPaused();
        // Block transfers while a Rig is being piloted (i.e., is not `PARKED`)
        uint256 tokenId = startTokenId;
        for (uint256 end = tokenId + quantity; tokenId < end; ++tokenId) {
            // If `Pilot.startTime` is not zero, then the Rig is in-flight
            if (_startTime(uint16(tokenId)) > 0) revert InvalidPilotStatus();
        }
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }

    /**
     * @dev Required to create and receive an ERC-721 Tableland TABLE token for pilot sessions.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) public pure returns (bytes4) {
        return 0x150b7a02;
    }

    // =============================
    //           IERC165
    // =============================

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721AUpgradeable, IERC721AUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            ERC721AUpgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId);
    }

    // =============================
    //       UUPSUpgradeable
    // =============================

    /**
     * @dev See {UUPSUpgradeable-_authorizeUpgrade}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {} // solhint-disable no-empty-blocks
}
