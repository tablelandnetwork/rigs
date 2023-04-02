// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

interface MockDelegateCashInterface {
    function checkDelegateForToken(
        address delegate,
        address vault,
        address contract_,
        uint256 tokenId
    ) external view returns (bool);

    function registerDelegate(
        address delegate,
        address vault,
        address contract_,
        uint256 tokenId
    ) external;
}

contract DelegateCashMock is MockDelegateCashInterface {
    mapping(address => mapping(address => mapping(uint256 => mapping(address => bool)))) delegations;

    function checkDelegateForToken(
        address delegate,
        address vault,
        address contract_,
        uint256 tokenId
    ) external view returns (bool) {
        return delegations[vault][contract_][tokenId][delegate];
    }

    function registerDelegate(
        address delegate,
        address vault,
        address contract_,
        uint256 tokenId
    ) external {
        delegations[vault][contract_][tokenId][delegate] = true;
    }
}
