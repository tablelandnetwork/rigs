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

    // Table prefix for the Rigs pilot sessions table.
    string private constant RIG_PILOT_SESSIONS_PREFIX = "pilot_sessions";

    // Table prefix for the Rigs ownership index table.
    string private constant RIG_OWNERSHIP_INDEX_PREFIX = "rig_ownership_index";

    // Table ID for the Rigs pilot sessions table.
    uint256 private _rigPilotSessionsTableId;

    // Table ID for the Rigs pilot sessions table.
    // uint256 private _rigOwnershipIndexTableId = 1; // TODO ignore this for now; need to add table to deploy script

    // Tracks the Rig `tokenId` to its current `Pilot`.
    mapping(uint16 => Pilot) internal _pilots;

    // Tracks the packed `pilot` to the Rig `tokenId` to help check if a custom pilot is in use.
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
        _createPilotsTable();
    }

    /**
     * @dev Creates the pilot sessions table.
     */
    function _createPilotsTable() internal {
        _rigPilotSessionsTableId = TablelandDeployments.get().createTable(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "id integer primary key, rig_id integer not null, owner text not null, pilot_contract text, pilot_id integer, start_time integer not null, end_time integer",
                RIG_PILOT_SESSIONS_PREFIX
            )
        );
    }

    /**
     * @dev See {ITablelandRigs-pilotsTable}.
     */
    function pilotsTable() external view returns (string memory) {
        return
            SQLHelpers.toNameFromId(
                RIG_PILOT_SESSIONS_PREFIX,
                _rigPilotSessionsTableId
            );
    }

    /**
     * @dev See {ITablelandRigs-pilotInfo}.
     */
    function pilotInfo(uint256 tokenId) public view returns (Pilot memory) {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        return _pilots[uint16(tokenId)];
    }

    function _pilotStatus(uint256 tokenId) private view returns (GarageStatus) {
        Pilot memory p = _pilots[uint16(tokenId)];
        if (p.startTime == 0) {
            if (p.pilot == 0) return GarageStatus.UNTRAINED;
            // The `park` logic should set `pilot` to `0` if both of these are true:
            //   - `pilot` is currently `1`
            //   - rigs has not been training for long enough
            // ie, `park` results in a status of UNTRAINED or PARKED
            // In no other cases should `park` update `pilot` (it's either current or last used pilot)
            else return GarageStatus.PARKED;
        } else {
            // Invariant: pilot cannot be `0` if `startTime` is > `0`.
            // ie, if rig is training or being piloted, pilot is either the trainer or a real pilot
            if (p.pilot == 1) return GarageStatus.TRAINING;
            else return GarageStatus.PILOTED;
        }
    }

    function _canPilot(uint256 tokenId) private view returns (bool) {
        // two ways to pilot:
        //   1. in PARKED status
        //   2. in TRAINING status for long enough
        // Invariant: you cannot switch real pilots mid-flight, but you can go
        // from trainer -> real pilot to make it easier + cheaper to pilot (continue playing the game)
        Pilot memory p = _pilots[uint16(tokenId)];
        if (p.startTime == 0) {
            // Rig is either UNTRAINED or PARKED. It's not possible to pilot from UNTRAINED.
            return p.pilot != 0; // could be trainer (`1`) or real pilot
        } else if (p.pilot == 1) {
            return block.number >= p.startTime + 172800;
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
        if (_pilotStatus(tokenId) != GarageStatus.UNTRAINED)
            revert InvalidPilotStatus(tokenId);
        // Assign a trainer pilot to the Rig (a `pilot` value of `1`)
        _pilots[uint16(tokenId)] = Pilot(uint64(block.number), 1);
        // Insert the Rig training session into the Tableland `pilot_sessions` table
        TablelandDeployments.get().runSQL(
            address(this),
            _rigPilotSessionsTableId,
            SQLHelpers.toInsert(
                RIG_PILOT_SESSIONS_PREFIX,
                _rigPilotSessionsTableId,
                "rig_id,owner,start_time",
                string.concat(
                    StringsUpgradeable.toString(uint64(tokenId)),
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
        address pilotContract,
        uint256 pilotTokenId
    ) public {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to pilot the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A()) revert Unauthorized();
        // Check if the Rig can be piloted
        if (!_canPilot(tokenId)) revert InvalidPilotStatus(tokenId);
        // Check if `pilotContract` is an ERC-721; cannot be the Rigs contract
        if (
            pilotContract == address(this) ||
            !pilotContract.supportsInterface(type(IERC721).interfaceId)
        ) revert InvalidCustomPilot();
        // Check ownership of pilot token ID at target `pilotContract`
        if (IERC721(pilotContract).ownerOf(pilotTokenId) != _msgSenderERC721A())
            revert InvalidCustomPilot();
        // Verify the pilot token ID fits into a uint32 (required for packing)
        if (pilotTokenId > type(uint32).max) revert InvalidCustomPilot();
        // Check if the pilot is actively piloting another Rig, and if so, park the other Rig
        // TODO not sure if this is right, for shifting/packing
        // See a better example: https://github.com/chiru-labs/ERC721A/blob/1843596cf863557fcd3bf0105222a7c29690af5c/contracts/ERC721A.sol#L233
        uint192 pilot = (uint192(uint160(pilotContract)) << 32) |
            uint192(pilotTokenId);
        if (_pilotIndex[pilot] != 0) {
            parkRig(_pilotIndex[pilot]);
        }
        // Assign a new pilot to the Rig and update the pilot index
        _pilots[uint16(tokenId)].pilot = pilot;
        _pilotIndex[pilot] = uint16(tokenId);
        // Insert the pilot into the Tableland `pilot_sessions` table
        TablelandDeployments.get().runSQL(
            address(this),
            _rigPilotSessionsTableId,
            SQLHelpers.toInsert(
                RIG_PILOT_SESSIONS_PREFIX,
                _rigPilotSessionsTableId,
                "rig_id,owner,pilot_contract,pilot_id,start_time",
                string.concat(
                    StringsUpgradeable.toString(uint64(tokenId)),
                    ",",
                    SQLHelpers.quote(
                        StringsUpgradeable.toHexString(ownerOf(tokenId))
                    ),
                    ",",
                    SQLHelpers.quote(Strings.toHexString(pilotContract)),
                    ",",
                    StringsUpgradeable.toString(uint64(pilotTokenId)),
                    ",",
                    StringsUpgradeable.toString(uint64(block.number))
                )
            )
        );
        emit Piloted(tokenId);
    }

    /**
     * @dev See {ITablelandRigs-batchPilotRigs}.
     */
    function pilotRig(
        uint256[] calldata tokenIds,
        address[] calldata pilotContracts,
        uint256[] calldata pilotTokenIds
    ) external {
        // Ensure the arrays are non-empty
        if (
            tokenIds.length == 0 ||
            pilotContracts.length == 0 ||
            pilotTokenIds.length == 0
        ) revert InvalidBatchPilotRig();
        // Ensure there is a 1:1 relationship between Rig `tokenIds` and pilots
        // Only allow a batch to be an arbitrary max length of 255
        // Clients should restrict this further (e.g., <=5) to avoid gas exceeding limits
        if (
            tokenIds.length != pilotContracts.length ||
            tokenIds.length != pilotTokenIds.length ||
            tokenIds.length > type(uint8).max
        ) revert InvalidBatchPilotRig();
        // For each token, call `pilotRig`
        // TODO optimize with impl using `toBatchInsert` vs. calling `pilotRig`
        for (uint8 i = 0; i < tokenIds.length; i++) {
            pilotRig(tokenIds[i], pilotContracts[i], pilotTokenIds[i]);
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
        // TODO error thrown here with `Should not allow the same pilot to operate multiple Rigs`
        if (
            !(_pilotStatus(tokenId) == GarageStatus.TRAINING ||
                _pilotStatus(tokenId) == GarageStatus.PILOTED)
        ) revert InvalidPilotStatus(tokenId);
        // Only update the row with the matching `rig_id` and `start_time`
        uint64 startTime = _pilots[uint16(tokenId)].startTime;
        string memory filters = string.concat(
            "rig_id=",
            StringsUpgradeable.toString(uint64(tokenId)),
            " and ",
            "start_time=",
            StringsUpgradeable.toString(startTime)
        );
        // Session update type is dependent on training completion status
        string memory setters;
        // Check if training has completed (30 days worth of blocks have elapsed; the required training time)
        if (
            _pilotStatus(tokenId) == GarageStatus.TRAINING &&
            !(block.number >= startTime + 172800)
        ) {
            // Pilot training is incomplete; reset the training pilot such that the Rig must train again
            _pilots[uint16(tokenId)].pilot = 0;
            // Update the row in `pilot_sessions` table with its `end_time` equal to the `start_time` (no flight time)
            setters = string.concat(
                "end_time=",
                StringsUpgradeable.toString(startTime)
            );
        } else {
            // Training is complete; update the row in the `pilot_sessions` table with its `end_time`
            setters = string.concat(
                "end_time=(",
                StringsUpgradeable.toString(uint64(block.number)),
                "-",
                StringsUpgradeable.toString(startTime),
                ")"
            );
        }
        // Set the `startTime` to `0` to indicate the Rig is now parked
        _pilots[uint16(tokenId)].startTime = 0;
        // Update the pilot information in the Tableland `pilot_sessions` table
        TablelandDeployments.get().runSQL(
            address(this),
            _rigPilotSessionsTableId,
            SQLHelpers.toUpdate(
                RIG_PILOT_SESSIONS_PREFIX,
                _rigPilotSessionsTableId,
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
        // Block transfers while a Rig is being piloted
        uint256 tokenId = startTokenId;
        for (uint256 end = tokenId + quantity; tokenId < end; ++tokenId) {
            // If `Pilot.startTime` is not zero, then the Rig is in-flight
            if (_pilots[uint16(tokenId)].startTime > 0)
                revert InvalidPilotStatus(tokenId);
        }
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }

    /**
     * @dev See {ERC721A-_afterTokenTransfers}.
     */
    function _afterTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override {
        // Insert Rig ownership data into a table, for indexing purposes in Tableland
        // TODO this increases gas by 1.5-2x
        // For a mint: 94768 -> 152429
        // For a simple transfer: 57993 -> 115663
        /*
        if (quantity > 1) {
            uint256 tokenId = startTokenId;
            string[] memory values = new string[](quantity);
            for (uint256 end = tokenId + quantity; tokenId < end; ++tokenId) {
                values[tokenId + quantity - end] = string.concat(
                    StringsUpgradeable.toString(uint64(tokenId)),
                    ",",
                    SQLHelpers.quote(StringsUpgradeable.toHexString(to)),
                    ",",
                    Strings.toString(uint64(block.number))
                );
            }
            TablelandDeployments.get().runSQL(
                address(this),
                _rigOwnershipIndexTableId,
                SQLHelpers.toBatchInsert(
                    RIG_OWNERSHIP_INDEX_PREFIX,
                    _rigOwnershipIndexTableId,
                    "rig_id,owner,block_number",
                    values
                )
            );
        } else {
            TablelandDeployments.get().runSQL(
                address(this),
                _rigOwnershipIndexTableId,
                SQLHelpers.toInsert(
                    RIG_OWNERSHIP_INDEX_PREFIX,
                    _rigOwnershipIndexTableId,
                    "rig_id,owner,block_number",
                    string.concat(
                        StringsUpgradeable.toString(uint64(startTokenId)),
                        ",",
                        SQLHelpers.quote(StringsUpgradeable.toHexString(to)),
                        ",",
                        Strings.toString(uint64(block.number))
                    )
                )
            );
        }
        */
        super._afterTokenTransfers(from, to, startTokenId, quantity);
    }

    /**
     * @dev Required to create and receive an ERC-721 Tableland TABLE token for `pilot_sessions`.
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
