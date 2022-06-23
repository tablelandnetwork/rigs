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
import "./ITablelandRigs.sol";
import "./utils/URITemplate.sol";

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
    uint256 private _maxSupply;
    // The price of minting a token.
    uint256 private _mintPrice;

    constructor(
        uint256 fixedSupply,
        uint256 mintPrice,
        string memory uriTemplate,
        address payable _beneficiary,
        address payable royaltyReceiver
    ) ERC721A("Tableland Rigs", "RIG") URITemplate(uriTemplate) {
        _maxSupply = fixedSupply;
        _mintPrice = mintPrice;
        setBeneficiary(_beneficiary);
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    /// @notice Emitted when a buyer is refunded.
    event Refund(address indexed buyer, uint256 amount);

    /// @notice Emitted on all purchases of non-zero amount.
    event Revenue(
        address indexed beneficiary,
        uint256 numPurchased,
        uint256 amount
    );

    /**
     * @dev See {ITablelandRigs-mint}.
     */
    function mint(uint256 quantity)
        external
        payable
        override
        nonReentrant
        whenNotPaused
    {
        // Check quantity is non-zero and doesn't exceed remaining quota
        require(quantity > 0, "TablelandRigs: Quantity is zero");
        quantity = Math.min(quantity, _maxSupply - totalSupply());
        require(quantity > 0, "TablelandRigs: Sold out");

        // Check sufficient value
        uint256 _cost = cost(quantity);
        if (msg.value < _cost) {
            revert(
                string(
                    abi.encodePacked(
                        "TablelandRigs: Costs ",
                        _toString(_cost / 1e9),
                        " GWei"
                    )
                )
            );
        }

        // Mint effect and interaction
        _safeMint(_msgSenderERC721A(), quantity);

        // Handle funds
        if (_cost > 0) {
            Address.sendValue(beneficiary, _cost);
            emit Revenue(beneficiary, quantity, _cost);
        }
        if (msg.value > _cost) {
            address payable reimburse = payable(_msgSenderERC721A());
            uint256 refund = msg.value - _cost;
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, bytes memory returnData) = reimburse.call{
                value: refund
            }("");
            require(success, string(returnData));
            emit Refund(reimburse, refund);
        }
    }

    function cost(uint256 quantity) private view returns (uint256) {
        return quantity * _mintPrice;
    }

    // The address receiving mint revenue.
    address payable public beneficiary;

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

    function maxSupply() external view returns (uint256) {
        return _maxSupply;
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
        override(ERC2981, ERC721A, IERC721A)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
