// SPDX-License-Identifier: MIT
pragma solidity >=0.8.10 <0.9.0;

import "erc721a/contracts/ERC721A.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./ITablelandRigs.sol";
import "./utils/URITemplate.sol";

import "hardhat/console.sol";

/**
 * @dev Implementation of {ITablelandRigs}.
 */
contract TablelandRigs is
    ITablelandRigs,
    URITemplate,
    ERC721A,
    ERC721AQueryable,
    Ownable,
    Pausable,
    ReentrancyGuard,
    ERC2981
{
    // The maximum number of tokens that can be minted.
    uint256 public immutable maxSupply;

    // The price of minting a token.
    uint256 public immutable mintPrice;

    // The address receiving mint revenue.
    address payable public beneficiary;

    bytes32 public immutable root;

    bool public claimsOpen;
    bool public mintsOpen;

    constructor(
        uint256 _maxSupply,
        uint256 _mintPrice,
        address payable _beneficiary,
        address payable royaltyReceiver,
        string memory uriTemplate,
        bytes32 merkleroot
    ) ERC721A("Tableland Rigs", "RIG") URITemplate(uriTemplate) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        setBeneficiary(_beneficiary);
        _setDefaultRoyalty(royaltyReceiver, 500);
        root = merkleroot;
    }

    /**
     * @dev See {ITablelandRigs-mint}.
     */
    function mint(uint256 quantity)
        external
        payable
        override
        whenNotPaused
        whenMintsOpen
    {
        _mint(quantity);
    }

    function claim(
        uint256 quantity,
        uint256 allowance,
        bytes32[] calldata proof
    ) external payable whenNotPaused whenClaimsOpen {
        if (!_verify(_leaf(_msgSenderERC721A(), allowance), proof)) {
            revert InvalidClaim();
        }

        if (quantity == 0) {
            revert ZeroQuantity();
        }

        uint64 claimed = _getAux(_msgSenderERC721A());
        quantity = Math.min(quantity, allowance - uint256(claimed));
        if (quantity == 0) {
            revert InsufficientAllowance();
        }

        claimed = claimed + uint64(quantity);
        _setAux(_msgSenderERC721A(), claimed);

        _mint(quantity);

        // sanity check
        assert(allowance <= claimed);
    }

    function _mint(uint256 quantity) private nonReentrant {
        // Check quantity is non-zero and doesn't exceed remaining quota
        if (quantity == 0) {
            revert ZeroQuantity();
        }
        quantity = Math.min(quantity, maxSupply - totalSupply());
        if (quantity == 0) {
            revert SoldOut();
        }

        // Check sufficient value
        uint256 cost = _cost(quantity);
        if (msg.value < cost) {
            revert InsufficientValue(cost);
        }

        // Mint effect and interaction
        _safeMint(_msgSenderERC721A(), quantity);

        // Handle funds
        if (cost > 0) {
            Address.sendValue(beneficiary, cost);
            emit Revenue(beneficiary, quantity, cost);
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

    function _cost(uint256 quantity) private view returns (uint256) {
        return quantity * mintPrice;
    }

    function _leaf(address account, uint256 quantity)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(account, quantity));
    }

    function _verify(bytes32 leaf, bytes32[] memory proof)
        internal
        view
        returns (bool)
    {
        return MerkleProof.verify(proof, root, leaf);
    }

    function setBeneficiary(address payable _beneficiary) public onlyOwner {
        beneficiary = _beneficiary;
    }

    /**
     * @dev See {ITablelandRigs-setURITemplate}.
     */
    function setURITemplate(string memory uriTemplate)
        public
        override
        onlyOwner
    {
        _setURITemplate(uriTemplate);
    }

    function contractURI() public pure returns (string memory) {
        return "fixme";
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721A, IERC721A)
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        return _getTokenURI(_toString(tokenId));
    }

    function openClaims() external onlyOwner {
        claimsOpen = true;
        emit ClaimsOpen();
    }

    function openMints() external onlyOwner {
        mintsOpen = true;
        emit MintsOpen();
    }

    error ClaimsNotOpen();

    error MintsNotOpen();

    modifier whenClaimsOpen() {
        if (!claimsOpen) {
            revert ClaimsNotOpen();
        }
        _;
    }

    modifier whenMintsOpen() {
        if (!mintsOpen) {
            revert MintsNotOpen();
        }
        _;
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
     * @dev See {ERC721A-_startTokenId}.
     */
    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, IERC721A, ERC2981)
        returns (bool)
    {
        return
            ERC721A.supportsInterface(interfaceId) ||
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
