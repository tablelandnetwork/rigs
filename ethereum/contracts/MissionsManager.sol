// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {TablelandDeployments} from "@tableland/evm/contracts/utils/TablelandDeployments.sol";
import {SQLHelpers} from "@tableland/evm/contracts/utils/SQLHelpers.sol";

/// TODO: add events??? seems like a good idea, especially when using a cheap chain

contract MissionsManager is AccessControl {
    /// @dev A role that is allow to administer missions
    bytes32 public constant MISSIONS_ADMIN_ROLE = keccak256("MISSIONS_ADMIN");

    /// @dev Struct that holds information about a Tableland table
    struct TableInfo {
        uint256 id;
        string name;
    }

    TableInfo private _missionsTable;
    TableInfo private _contributionsTable;

    /// @dev Mapping between missionId -> contributions disabled.
    mapping(uint256 => bool) private _contributionsDisabled;

    constructor(TableInfo memory missionsTable, TableInfo memory contributionsTable) {
        _missionsTable = missionsTable;
        _contributionsTable = contributionsTable;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MISSIONS_ADMIN_ROLE, msg.sender);
    }

    /// @dev Enables or disables contributions for the given `missionId`.
    function setContributionsDisabled(uint256 missionId, bool disabled) external onlyRole(MISSIONS_ADMIN_ROLE) {
        _contributionsDisabled[missionId] = disabled;

        string memory disabledString = disabled ? "1" : "0";

        // Update table state as well for easier querying
        string memory stmnt = string.concat(
            "UPDATE ",
            _missionsTable.name,
            " SET contributions_disabled=",
            disabledString,
            " WHERE id=",
            Strings.toString(missionId)
        );
        TablelandDeployments.get().mutate(address(this), _missionsTable.id, stmnt);
    }

    /// @dev Returns true if contributions are disabled for the given `missionId`, otherwise false.
    function contributionsDisabled(uint256 missionId) external view returns (bool) {
        return _contributionsDisabled[missionId];
    }

    /// @notice Submit a contribution to a mission
    ///
    /// @param missionId  The mission id
    /// @param data       JSON-string with the data for the submission
    function submitMissionContribution(uint256 missionId, string memory data) external {
        require(!_contributionsDisabled[missionId], "Contributions disabled for mission");

        string memory insert = string.concat(
            "INSERT INTO ",
            _contributionsTable.name,
            " (mission_id, contributor, created_at, data)  VALUES (",
            Strings.toString(missionId),
            ", '",
            Strings.toHexString(msg.sender),
            "', ",
            "BLOCK_NUM()",
            ", ",
            SQLHelpers.quote(data),
            ")"
        );

        TablelandDeployments.get().mutate(address(this), _contributionsTable.id, insert);
    }
}
