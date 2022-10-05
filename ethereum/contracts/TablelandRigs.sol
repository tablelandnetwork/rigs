// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
// TODO use to `StringsUpgradeable`
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@tableland/evm/contracts/utils/TablelandDeployments.sol";
// TODO Hardhat can't find `SQLHelpers`, and it doesn't support https imports?? Temporary workaround local import.
import "./utils/SQLHelpers.sol";
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

    // TODO Remove the following, but for context, some comments on the table schema:
    /**
        create table rig_pilots(
            id integer primary key, 
            rig_id int not null,
            pilot_contract text, 
            pilot_id int,
            start_time int not null,
            total_flight_time int
            // ^Altered this to be nullable since each row == session, so the flight time isn't always known, and
            // could also rename to just `flight_time` since it's no longer cumulative, with this approach.
            // unique(rig_id, pilot_contract, pilot_id) 
            // ^removed this constraint since rows == sessions; can have duplicate pilot rows per rig
            // E.g., Pilot A -> Park -> Pilot B -> Park -> Pilot A

            // Is this the right approach?
        );
     */

    // Table prefix for the Rigs Pilots table.
    string private constant RIG_PILOTS_PREFIX = "rig_pilots";

    // Table ID for the Rigs Pilots table.
    uint256 private _rigPilotsTableId;

    // Tracks the Rig `tokenId` to its current `RigPilot`.
    mapping(uint256 => RigPilot) internal _pilots;

    // Captures a Rig's starting flight time and Pilot's ERC721 info.
    struct RigPilot {
        // Keep track of the Pilot's starting block number for flight time tracking.
        // TODO check this should be a block number, not timestamp (Notion comments & intuition seems to prefer block.number)
        uint64 startBlockNumber;
        // Address of the ERC721 Pilot contract.
        address erc721;
        // Token ID of the ERC721 Pilot.
        uint256 tokenId;
        // Index of the current Pilot, for tracking the history of a Rig's Pilots.
        // TODO is this the right way to track this? The index indicates unique pilot sessions,
        // which is useful in the subsequent logic in `trainRig`, `pilotRig`, and `parkRig`.
        // But, a single pilot could appear more than once with a different index. Meaning,
        // there would be duplicates here. E.g., Pilot A -> Park -> Pilot B -> Park -> Pilot A
        uint16 index;
    }

    function initialize(
        uint256 _maxSupply,
        uint256 _mintPrice,
        address payable _beneficiary,
        address payable royaltyReceiver,
        bytes32 _allowlistRoot,
        bytes32 _waitlistRoot // TODO add: uint256 rigPilotsTableId
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
        // _rigPilotsTableId = rigPilotsTableId;
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

    // TODO I've left the method descriptions for ease of reviewing them but will remove these, once ready.
    /**
     * @dev Retrieves pilot info for a Rig.
     *
     * tokenId - the unique Rig token identifier
     *
     * Requirements:
     *
     * - `tokenId` must exist
     */
    function pilotInfo(uint256 tokenId) public view returns (RigPilot memory) {
        // Check the Rig `tokenId` exists.
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        return _pilots[tokenId];
    }

    /**
     * @dev Retrieves pilot info for a Rig.
     *
     * tokenId - the unique Rig token identifier
     *
     * Requirements:
     *
     * - `tokenId` must exist
     * - `msg.sender` must own the Rig
     * - `RigPilot` of the Rig must have an index of `0`
     */
    function trainRig(uint256 tokenId) external {
        // Check the Rig `tokenId` exists.
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to train the specified Rig.
        // TODO is it worth including this in the if statement below?: getApproved(tokenId) != _msgSenderERC721A()
        // See: https://github.com/divergencetech/ethier/blob/a678bad65cf0215f04cce0dc3c41552cde0ee74c/contracts/erc721/ERC721ACommon.sol#L30
        if (_ownershipOf(tokenId).addr != _msgSenderERC721A())
            revert InvalidRigOwnership();
        // Check if the Rig has gone through training yet, where `index` 1 or greater represents piloting is or has occurred.
        if (_pilots[tokenId].index > 0) revert RigIsTrained(tokenId);
        // Assign a trainer Pilot to the Rig.
        _pilots[tokenId] = RigPilot(uint64(block.number), address(0), 0, 1);
        // Insert the pilot into the rig_pilots table.
        // TODO assumption: `total_flight_time` is only updated upon parking? Thus, not included here?
        TablelandDeployments.get().runSQL(
            address(this),
            _rigPilotsTableId,
            SQLHelpers.toInsert(
                RIG_PILOTS_PREFIX,
                _rigPilotsTableId,
                "rig_id, start_time",
                string.concat(
                    Strings.toString(tokenId),
                    ",",
                    Strings.toString(block.number)
                )
            )
        );
        emit Training(tokenId);
    }

    /**
     * @dev Sets the `RigPilot` for a Rig in `_pilots` and the Tableland `rig_pilots` table.
     *
     * tokenId - the unique Rig token identifier
     * pilotContract - ERC721 contract address of a desired Rig's Pilot
     * pilotTokenId - the unique token identifier at the target `pilotContract`
     *
     * Requirements:
     *
     * - `tokenId` must exist
     * - `msg.sender` must own the Rig
     * - `RigPilot` of the Rig must *not* have an index of `0`
     * - `pilotContract` must be an ERC721 contract
     * - `pilotTokenId` must be owned by `msg.sender` at `pilotContract`
     */
    // TODO should this `ERC165Checker` go here, or at the top of the contract?
    using ERC165Checker for address;

    function pilotRig(
        uint256 tokenId,
        address pilotContract,
        uint256 pilotTokenId
    ) external {
        // Check the Rig `tokenId` exists.
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to pilot the specified Rig.
        if (_ownershipOf(tokenId).addr != _msgSenderERC721A())
            revert InvalidRigOwnership();
        // Ensure Pilot is not the first Pilot, where `index` 1 or greater represents training is or has occurred.
        // TODO is the assumption `pilotRig` will be called only when the required training flight time has elapsed?
        // Or, does there need to exist a "training lock" mapping, sort of similar to the registry's `_locks`? Or, does SQL to handle this?
        uint16 currentPilotIndex = _pilots[tokenId].index;
        if (currentPilotIndex == 0) revert RigIsNotTrained(tokenId);
        // Check if `pilotContract` is an ERC721.
        // TODO should we allow ERC1155s as well? (previously noted by asutula)
        if (!pilotContract.supportsInterface(type(IERC721).interfaceId))
            revert InvalidPilotContract();
        // Check ownership of `pilotTokenId` at target `pilotContract`.
        // TODO what happens if the pilot gets sold? i.e., the Rig will still show its being piloted by the non-owned pilot NFT.
        if (IERC721(pilotContract).ownerOf(pilotTokenId) != _msgSenderERC721A())
            revert InvalidPilotOwnership();
        // Assign a new Pilot to the Rig, incrementing the previous Pilot's `index` by 1.
        // TODO should `SafeMath` be used here?
        uint16 newPilotIndex = currentPilotIndex + 1;
        _pilots[tokenId] = RigPilot(
            uint64(block.number),
            pilotContract,
            pilotTokenId,
            newPilotIndex
        );
        // Insert the pilot into the rig_pilots table.
        // TODO assumption: `total_flight_time` is only updated upon parking? Thus, not included here?
        /**
            INSERT INTO rigs_pilots (
                rig_id, pilot_contract, pilot_id, 
                start_time
            ) 
            VALUES 
            (
                tokenId, pilotContract, pilotTokenId, 
                block.number
            )
         */
        TablelandDeployments.get().runSQL(
            address(this),
            _rigPilotsTableId,
            SQLHelpers.toInsert(
                RIG_PILOTS_PREFIX,
                _rigPilotsTableId,
                "rig_id, pilot_contract, pilot_id, start_time",
                string.concat(
                    Strings.toString(tokenId),
                    ",",
                    Strings.toHexString(pilotContract),
                    ",",
                    Strings.toString(pilotTokenId),
                    ",",
                    Strings.toString(block.number)
                )
            )
        );
        emit Piloted(tokenId);
    }

    // TODO This wasn't spec'd out -- I think it's needed, right?
    /**
     * @dev Updates the `RigPilot` for a Rig in `_pilots` and the Tableland `rig_pilots` table.
     *
     * tokenId - the unique Rig token identifier
     *
     * Requirements:
     *
     * - `tokenId` must exist
     * - `msg.sender` must own the Rig
     * - `startBlockNumber` of the current `RigPilot` should not be zero (0 == parked)
     */
    function parkRig(uint256 tokenId) external {
        // Check the Rig `tokenId` exists.
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to park the specified Rig.
        if (_ownershipOf(tokenId).addr != _msgSenderERC721A())
            revert InvalidRigOwnership();
        // Ensure Rig is currently being piloted.
        uint64 startBlockNumber = _pilots[tokenId].startBlockNumber;
        if (startBlockNumber == 0) revert RigIsParked(tokenId);
        // Update the Pilot, resetting the `startBlockNumber` to `0` to indicate it's now parked.
        _pilots[tokenId].startBlockNumber = 0;
        // Update the row in the rig_pilots table with its `total_flight_time`.
        string memory setters = string.concat(
            "start_time=0,total_flight_time=(",
            Strings.toString(block.number),
            "-",
            Strings.toString(startBlockNumber),
            ")"
            // TODO or, this could subtract the `start_time` value; they should be the same, but is there a better practice?
        );
        // Only update the row with the matching `rig_id` and `start_time`.
        string memory filters = string.concat(
            "rig_id=",
            Strings.toString(tokenId),
            " and ",
            "start_time=",
            Strings.toString(startBlockNumber)
        );
        // Update the pilot information in the rig_pilots table.
        /**
            UPDATE 
                rig_pilots 
            SET 
                start_time=0, 
                total_flight_time=(block.number-startBlockNumber) 
            WHERE 
                rig_id=tokenId 
                and start_time=startBlockNumber
         */
        TablelandDeployments.get().runSQL(
            address(this),
            _rigPilotsTableId,
            SQLHelpers.toUpdate(
                RIG_PILOTS_PREFIX,
                _rigPilotsTableId,
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
            // If `startBlockNumber` is not zero, then the Rig is in-flight.
            if (_pilots[tokenId].startBlockNumber > 0)
                revert RigIsPiloted(tokenId);
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
