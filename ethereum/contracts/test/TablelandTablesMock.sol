// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

/**
 * @dev Test-only stand-in for the `TablelandTables` registry. It accepts the
 * `create` and `mutate` calls made by `TablelandRigPilots` and does nothing.
 */
contract TablelandTablesMock {
    function create(address, string memory) external payable returns (uint256) {
        return 1;
    }

    function mutate(address, uint256, string memory) external payable {} // solhint-disable no-empty-blocks
}
