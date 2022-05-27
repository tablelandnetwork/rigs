// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "erc721a/contracts/ERC721A.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "erc721a/contracts/extensions/ERC721ABurnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract TablelandRigs is
    ERC721A,
    ERC721ABurnable,
    ERC721AQueryable,
    Ownable,
    Pausable {

    string private _baseURIString;

    constructor(string memory baseURI) ERC721A("Tableland Rigs", "RIG") {
        _baseURIString = baseURI;
    }

    function mint(uint256 quantity) external payable whenNotPaused {
        _safeMint(msg.sender, quantity);
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseURIString = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseURIString;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override (ERC721A)
        returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
