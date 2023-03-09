// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";

/**
 * @dev Interface for IERC4906 (EIP-721 Metadata Update Extension).
 */
interface IERC4906 {
    /**
     * @dev This event emits when the metadata of a token is changed.
     * So that the third-party platforms such as NFT market could
     * timely update the images and related attributes of the NFT.
     */
    event MetadataUpdate(uint256 _tokenId);

    /**
     * @dev This event emits when the metadata of a range of tokens is changed.
     * So that the third-party platforms such as NFT market could
     * timely update the images and related attributes of the NFTs.
     */
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}
