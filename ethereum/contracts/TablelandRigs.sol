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
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
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

    // TODO Remove the following, but for context, the table schema:
    /**
        create table rig_pilot_sessions(
            id integer primary key, 
            rig_id integer not null, 
            owner text not null,
            pilot_contract text, 
            pilot_id integer, 
            start_time integer not null, 
            end_time integer
        )
     */

    // Table prefix for the Rigs pilot sessions table.
    string private constant RIG_PILOT_SESSIONS_PREFIX = "rig_pilot_sessions";

    // Table ID for the Rigs pilot sessions table.
    // TODO do we want to have a method for updating this value?
    uint256 private _rigPilotSessionsTableId;

    // Tracks the Rig `tokenId` to its current `RigPilot`.
    mapping(uint256 => RigPilot) internal _pilots;

    // Track piloted vs. parked Rigs as a bitlist.
    // TODO this was implemented for gas reduction purposes while iterating/checking for duplicates in `_pilots`
    uint8[] internal _rigsStatus;

    function initialize(
        uint256 _maxSupply,
        uint256 _mintPrice,
        address payable _beneficiary,
        address payable royaltyReceiver,
        bytes32 _allowlistRoot,
        bytes32 _waitlistRoot,
        uint256 rigPilotSessionsTableId
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
        _rigPilotSessionsTableId = rigPilotSessionsTableId;
        _rigsStatus = new uint8[](_maxSupply);
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
     * @dev See {ITablelandRigs-pilotInfo}.
     */
    function pilotInfo(uint256 tokenId) public view returns (RigPilot memory) {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        return _pilots[tokenId];
    }

    /**
     * @dev See {ITablelandRigs-rigStatus}.
     */
    // TODO this was created for testing purposes, but it isn't "required" if deemed redundant with `pilotInfo`
    function rigStatus(uint256 tokenId) public view returns (uint8) {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        return _rigsStatus[tokenId - 1];
    }

    /**
     * @dev See {ITablelandRigs-trainRig}.
     */
    function trainRig(uint256 tokenId) external {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to train the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A())
            revert InvalidRigOwnership(tokenId);
        // Check if the Rig has gone through training yet
        // An `index` of `1` represents training is happening; the Rig is "locked" into training for 30 days
        if (_pilots[tokenId].index > 0) revert RigIsTrainingOrTrained(tokenId);
        // Assign a trainer pilot to the Rig
        // TODO is it worth using `SafeCastUpgradeable.toUint64`? Also impacts `_setClaimed` and some methods below
        _pilots[tokenId] = RigPilot(1, uint64(block.number), address(0), 0);
        _rigsStatus[tokenId - 1] = 1;
        // Insert the training pilot into the Tableland `rig_pilot_sessions` table
        // TODO Remove the following, but for context, the statement
        /**
            INSERT INTO rigs_pilots (
                rig_id, owner, start_time
            ) 
            VALUES 
            (
                tokenId, ownerOf(tokenId), block.number
            )
         */
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
                    StringsUpgradeable.toHexString(ownerOf(tokenId)),
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
    ) external {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to pilot the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A())
            revert InvalidRigOwnership(tokenId);
        // Validate if pilot training is completed
        // Once training begins, the Rig is prevented from being parked until
        // training has been completed; thus, only need to check if the Rig has
        // been ungaraged yet since parking handles training logic (see `parkRig` for more details)
        if (_pilots[tokenId].index == 0) revert RigIsNotTrained(tokenId);
        // Check if Rig is currently in-flight (not parked)
        if (_pilots[tokenId].startTime > 0) revert RigIsNotParked(tokenId);
        // Check if `pilotContract` is an ERC721; cannot be the Rigs contract
        // TODO is this the right way to handle checking if the ERC721 is the Rigs contract? Or, is there a different way w/upgradeable contracts
        if (
            !pilotContract.supportsInterface(type(IERC721).interfaceId) ||
            (pilotContract.supportsInterface(type(IERC721).interfaceId) &&
                pilotContract == address(this))
        ) revert InvalidPilotContract(pilotContract);
        // Check ownership of `pilotTokenId` at target `pilotContract`
        if (IERC721(pilotContract).ownerOf(pilotTokenId) != _msgSenderERC721A())
            revert InvalidPilotOwnership(pilotTokenId);
        // Check if the pilot is actively piloting another Rig, and if so, park the other Rig
        for (uint256 i = 1; i <= maxSupply; i++) {
            if (
                // `_rigsStatus` starts at index `0`, while `tokenId` in `_pilots` starts at `1`
                _rigsStatus[i - 1] == 1 &&
                (_pilots[i].pilotContract == pilotContract &&
                    _pilots[i].pilotId == pilotTokenId)
            ) {
                parkRig(i);
            }
        }
        // Assign a new pilot to the Rig, incrementing the previous pilot's `index` by `1`
        _pilots[tokenId] = RigPilot(
            _pilots[tokenId].index + 1,
            uint64(block.number),
            pilotContract,
            pilotTokenId
        );
        _rigsStatus[tokenId - 1] = 1;
        // Insert the pilot into the Tableland `rig_pilot_sessions` table
        // TODO Remove the following, but for context, the statement
        /**
            INSERT INTO rigs_pilots (
                rig_id, owner, pilot_contract, 
                pilot_id, start_time
            ) 
            VALUES 
            (
                tokenId, ownerOf(tokenId), pilotContract,
                pilotTokenId, block.number
            )
         */
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
                    StringsUpgradeable.toHexString(ownerOf(tokenId)),
                    ",",
                    Strings.toHexString(pilotContract),
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
     * @dev See {ITablelandRigs-parkRig}.
     */
    function parkRig(uint256 tokenId) public {
        // Check the Rig `tokenId` exists.
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to park the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A()) {
            if (address(this) != _msgSenderERC721A()) {
                revert InvalidRigOwnership(tokenId);
            }
        }
        // Ensure Rig is currently being piloted
        uint64 startTime = _pilots[tokenId].startTime;
        if (startTime == 0) revert RigIsParked(tokenId);
        // Ensure the Rig has trained; `index` of `1` indicates training is occurring
        // If the Rig is training, check if 30 days has elapsed (the required training time)
        (bool isValidSubtraction, uint256 blockDifference) = SafeMathUpgradeable
            .trySub(block.number, 172800);
        if (
            !isValidSubtraction ||
            _pilots[tokenId].index == 0 ||
            (_pilots[tokenId].index == 1 &&
                !(blockDifference > _pilots[tokenId].startTime))
        ) {
            revert RigIsNotTrained(tokenId);
        }
        // Update the pilot, resetting values (except `index`) to `0` to indicate it's now parked
        _pilots[tokenId].startTime = 0;
        _pilots[tokenId].pilotContract = address(0);
        _pilots[tokenId].pilotId = 0;
        _rigsStatus[tokenId - 1] = 0;
        // Update the row in the `rig_pilot_sessions` table with its `end_time`
        string memory setters = string.concat(
            "start_time=0,end_time=(",
            StringsUpgradeable.toString(uint64(block.number)),
            "-",
            StringsUpgradeable.toString(startTime),
            ")"
        );
        // Only update the row with the matching `rig_id` and `start_time`
        string memory filters = string.concat(
            "rig_id=",
            StringsUpgradeable.toString(uint64(tokenId)),
            " and ",
            "start_time=",
            StringsUpgradeable.toString(startTime)
        );
        // Update the pilot information in the Tableland `rig_pilot_sessions` table
        // TODO Remove the following, but for context, the statement
        /**
            UPDATE 
                rig_pilot_sessions 
            SET 
                start_time=0, 
                end_time=(block.number-startTime) 
            WHERE 
                rig_id=tokenId 
                and start_time=startTime
         */
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
     * Also, adds logic to block transfers while a Rig is being piloted.
     */
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override {
        _requireNotPaused();
        uint256 tokenId = startTokenId;
        for (uint256 end = tokenId + quantity; tokenId < end; ++tokenId) {
            // If `RigPilot.startTime` is not zero, then the Rig is in-flight
            if (_pilots[tokenId].startTime > 0) revert RigIsNotParked(tokenId);
        }
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
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
