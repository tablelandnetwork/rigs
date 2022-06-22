// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "erc721a/contracts/ERC721A.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ITablelandRigs.sol";
import "./utils/Strings.sol";

/**
 * @dev Implementation of {ITablelandRigs}.
 */
contract TablelandRigs is
    ITablelandRigs,
    ERC721A,
    ERC721AQueryable,
    Ownable,
    Pausable
{
    // A URI used to reference off-chain metadata.
    string private _baseURIString;

    constructor(string memory baseURI) ERC721A("Tableland Rigs", "RIG") {
        _baseURIString = baseURI;
    }

    /**
     * @dev See {ITablelandRigs-mint}.
     */
    function mint(uint256 quantity) external payable override whenNotPaused {
        _safeMint(_msgSenderERC721A(), quantity);
    }

    /**
     * @dev See {ITablelandRigs-setBaseURI}.
     */
    function setBaseURI(string memory baseURI) external override onlyOwner {
        _baseURIString = baseURI;
    }

    /**
     * @dev See {ERC721A-_baseURI}.
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseURIString;
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        strings.slice memory suffix = strings.toSlice(_baseURI());
        strings.slice memory prefix;

        strings.split(suffix, strings.toSlice("{id}"), prefix);

        string memory uri = strings.concat(prefix, strings.toSlice(_toString(tokenId)));
        uri = strings.concat(strings.toSlice(uri), suffix);

        return uri;
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
}
