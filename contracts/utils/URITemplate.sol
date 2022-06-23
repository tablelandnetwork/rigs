// SPDX-License-Identifier: MIT
pragma solidity >=0.8.10 <0.9.0;

import "./Strings.sol";

contract URITemplate {
    // URI components used to build token URIs.
    string[] private _uriParts = new string[](2);

    constructor(string memory uriTemplate) {
        _setURITemplate(uriTemplate);
    }

    function _setURITemplate(string memory baseURITemplate) internal {
        Strings.Slice[] memory parts = new Strings.Slice[](2);
        parts[1] = Strings.toSlice(baseURITemplate);
        Strings.split(parts[1], Strings.toSlice("{id}"), parts[0]);
        _uriParts[0] = Strings.toString(parts[0]);
        _uriParts[1] = Strings.toString(parts[1]);
    }

    function _getTokenURI(string memory tokenIdStr)
        internal
        view
        returns (string memory)
    {
        return
            _uriParts.length != 0
                ? string(
                    abi.encodePacked(_uriParts[0], tokenIdStr, _uriParts[1])
                )
                : "";
    }
}
