// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./utils/URITemplate.sol";
import "./ITablelandRigs.sol";
import "./ITablelandRigPilots.sol";

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

    // Flag specifying whether or not claims.
    MintPhase public mintPhase;

    // URI for contract info.
    string private _contractInfoURI;

    // Pilots implementation.
    ITablelandRigPilots private _pilots;

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
    function mint(uint256 quantity) external payable whenNotPaused {
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
    ) external payable whenNotPaused {
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
    ) private pure returns (bytes32) {
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
    ) private pure returns (bool) {
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
    function setMintPhase(uint256 _mintPhase) external onlyOwner {
        mintPhase = MintPhase(_mintPhase);
        emit MintPhaseChanged(mintPhase);
    }

    /**
     * @dev See {ITablelandRigs-setBeneficiary}.
     */
    function setBeneficiary(address payable _beneficiary) public onlyOwner {
        beneficiary = _beneficiary;
    }

    /**
     * @dev See {ITablelandRigs-setURITemplate}.
     */
    function setURITemplate(string[] memory uriTemplate) external onlyOwner {
        _setURITemplate(uriTemplate);
    }

    /**
     * @dev See {ITablelandRigs-contractURI}.
     */
    function contractURI() public view returns (string memory) {
        return _contractInfoURI;
    }

    /**
     * @dev See {ITablelandRigs-setContractURI}.
     */
    function setContractURI(string memory uri) external onlyOwner {
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
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev See {ITablelandRigs-unpause}.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // =============================
    //      ITABLELANDRIGPILOTS
    // =============================

    /**
     * @dev See {ITablelandRigs-initPilots}.
     */
    function initPilots(address pilotsAddress) external onlyOwner {
        _pilots = ITablelandRigPilots(pilotsAddress);
    }

    /**
     * @dev See {ITablelandRigs-pilotSessionsTable}.
     */
    function pilotSessionsTable() external view returns (string memory) {
        return _pilots.pilotSessionsTable();
    }

    /**
     * @dev See {ITablelandRigs-pilotInfo}.
     */
    function pilotInfo(uint256 tokenId)
        external
        view
        returns (ITablelandRigPilots.PilotInfo memory)
    {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();

        return _pilots.pilotInfo(tokenId);
    }

    /**
     * @dev See {ITablelandRigs-trainRig}.
     */
    function trainRig(uint256 tokenId) external whenNotPaused {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to train the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A())
            revert ITablelandRigPilots.Unauthorized();

        _pilots.trainRig(_msgSenderERC721A(), tokenId);
    }

    /**
     * @dev See {ITablelandRigs-pilotRig}.
     */
    function pilotRig(
        uint256 tokenId,
        address pilotAddr,
        uint256 pilotId
    ) public whenNotPaused {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to pilot the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A())
            revert ITablelandRigPilots.Unauthorized();

        _pilots.pilotRig(_msgSenderERC721A(), tokenId, pilotAddr, pilotId);
    }

    /**
     * @dev See {ITablelandRigs-pilotRig}.
     */
    function pilotRig(
        uint256[] calldata tokenIds,
        address[] calldata pilotAddrs,
        uint256[] calldata pilotIds
    ) external whenNotPaused {
        // Ensure the arrays are non-empty
        if (
            tokenIds.length == 0 ||
            pilotAddrs.length == 0 ||
            pilotIds.length == 0
        ) revert ITablelandRigPilots.InvalidBatchPilotRig();

        // Ensure there is a 1:1 relationship between Rig `tokenIds` and pilots
        // Only allow a batch to be an arbitrary max length of 255
        // Clients should restrict this further (e.g., <=5) to avoid gas exceeding limits
        if (
            tokenIds.length != pilotAddrs.length ||
            tokenIds.length != pilotIds.length ||
            tokenIds.length > type(uint8).max
        ) revert ITablelandRigPilots.InvalidBatchPilotRig();

        // For each token, call `pilotRig`
        for (uint8 i = 0; i < tokenIds.length; i++) {
            pilotRig(tokenIds[i], pilotAddrs[i], pilotIds[i]);
        }
    }

    /**
     * @dev See {ITablelandRigs-parkRig}.
     */
    function parkRig(uint256 tokenId) external whenNotPaused {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();
        // Verify `msg.sender` is authorized to park the specified Rig
        if (ownerOf(tokenId) != _msgSenderERC721A())
            revert ITablelandRigPilots.Unauthorized();

        _pilots.parkRig(_msgSenderERC721A(), tokenId);
    }

    /**
     * @dev See {ITablelandRigs-parkRigAsOwner}.
     */
    function parkRigAsOwner(uint256 tokenId) external onlyOwner {
        // Check the Rig `tokenId` exists
        if (!_exists(tokenId)) revert OwnerQueryForNonexistentToken();

        _pilots.parkRig(_msgSenderERC721A(), tokenId);
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
            // If the pilot's `startTime` is not zero, then the Rig is in-flight
            if (_pilots.pilotStartTime(tokenId) > 0)
                revert ITablelandRigPilots.InvalidPilotStatus();
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
