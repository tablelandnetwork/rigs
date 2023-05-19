---
title: Token-based reputation
description: A minimal ERC-721 extension for token-based reputation.
author: Daniel Buchholz (@dtbuchholz) <dan@tableland.xyz>, Sander Pick (@sanderpick) <sander@tableland.xyz>
discussions-to: https://github.com/ethereum/eips/issues/<EIP_NUMBER> # TODO: Update
status: Draft
type: Standards Track
category: ERC
created: <yyyy-mm-dd> # TODO: Update
requires: 165, 721
---

## Abstract

This token-based reputation standard for Non-Fungible Tokens (NFTs) extends [ERC-721](https://eips.ethereum.org/EIPS/eip-721) by defining a standardized set of staking/unstaking actions and metadata attributes that correspond to reputation earned by the token owner, which also enable/disable trading these tokens on marketplaces.

## Motivation

NFTs are a conduit for holder-initiated actions that attribute to the token owner's reputation. Namely, this proposal introduces two primary components to help maintain a record of reputation earned on the blockchain:

- The concept of "soft" staking and unstaking wherein a token cannot be sold on marketplaces while staked, and the token ownership remains unchanged wherein the holder's account maintains ownership.
- Dynamic metadata changes, signaled by `Stake` and `Unstake` events, are materialized in the metadata by the implementer (OPTIONAL) using the data availability ("DA") layer.

For example, a token owner may stake or unstake their token to signal their support/disapproval for a project. Currently, there does not exist a lightweight standard for implementing these signals, which leads to disparate implementations and an overall lack of interoperable reputation across different communities. This proposal aims to standardize a set of staking/unstaking events, methods, and OPTIONAL dynamic metadata attributes that correspond to reputation earned by the token owner.

Note there are two existing EIPs that have somewhat of a similar approach but come with flaws from the perspective of generalizing an interface for the broadest set of use cases:

- [EIP-5192](https://eips.ethereum.org/EIPS/eip-5192): Designed for non-transferrable "soulbound" tokens ("SBT"), EIP-5192 has a few features that do not align with the token reputation requirements:
  - Lacks a way to initiate _both_ staking and unstaking actions through standardized method calls—it only provides a `locked` getter method, which is unneeded for many use cases.
  - Lack of indexed event parameters needed for the metadata, such as the caller's address or block number.
  - Potentially misleading nomenclature if used for non-SBT use cases, whereas "staking" is more applicable to not only reputation-based scenarios but is also widely adopted elsewhere.
- [EIP-5753](https://eips.ethereum.org/EIPS/eip-5753): Although EIP-5753 is currently a draft and yet to be accepted, it (essentially) changes EIP-5192 with the following:
  - Adds `lock` and `unlock` methods, which behave similar to the token reputation proposal's `stake` and `unstake` methods; however, `unlock` lacks the required method caller information, as do the `Lock` and `Unlock` events.
  - Changes the EIP-5192 `locked` getter to a function named `getLocked` that returns an address instead of boolean; but, getters SHOULD NOT be required for a minimal interface as this assumes contract storage is used to track reputation, which is not always the case (e.g., off-chain metadata / DA based reputation tracking).

These two EIPs also lack the emittance of a `block.number` within their events. This is a key component for enabling reputation in metadata, which is a primary yet OPTIONAL feature of this proposal. For reputation to dynamically change within the metadata, there MUST be block information in the event emittance for off-chain indexing as this is needed to materialize any metadata updates with block-related information. In other words, reputation is most often tracked with a start and end block number that bound the staking/unstaking activities.

For reference, [OpenSea](https://docs.opensea.io/docs/metadata-standards#disable-trading-for-staked-or-locked-tokens) leverages both of the events noted in EIP-5192 and EIP-5753 to disable trading for staked/locked tokens. There are other accepted events by OpenSea, including the `Stake` and `Unstake` events outlined in this proposal, which _do not_ have an EIP associated with them. Although it is not necessarily the primary motivation of this token reputation EIP, it's been noted to demonstrate how marketplaces are using this EIP's event definitions today. In other words, it is true that the events outlined in this proposal **will disable/enable trading a token on marketplaces**; this proposal _already_ has real-world usage.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

### Stake and Unstake Functions

An owner SHALL be able to "soft" stake and unstake their token; staking and unstaking a token SHOULD NOT require a change to the ownership of the token itself but simply emit events that signal the on-chain action taken. Staking a token with `function stake(...)` signals that the owner is staking their token to accrue reputation, such as earning block-based rewards, while the token cannot be sold; reputation SHOULD be earned for good behavior during this token state. Unstaking a token with `function unstake(...)` signals that the owner no longer wishes to stake the token and is available to be sold; reputation SHOULD NOT be earned while in an unstaked state.

These functions emit `Staked` and `Unstaked` events, respectively, to signal a change in state of the token. This allows for off-chain marketplaces to change listing behavior as well as the token's metadata to be dynamically changed; the metadata SHOULD be changed by the implementer upon event emittance, but is is entirely OPTIONAL. Namely, there is no required contract storage for token reputation, so the events and metadata are what actually SHOULD store reputation, as provided by the DA layer. The implementor can choose to store reputation in contract storage, if desired. It is a key design component as this keeps the interface as lightweight as possible while also ensuring there is not a lossy process for determining a token's reputation fully off-chain.

**Every contract compliant with this EIP MUST implement the `ERC721` interface.**

```solidity
// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

/**
 * @title A minimal ERC-721 extension for token-based reputation.
 */
interface ITokenReputation {
    /**
     * @notice Emitted when token staking is initiated.
     * @param tokenId Identifier for the token being staked.
     * @param owner The token owner who wants to stake the token.
     * @param block The block number at the time of staking.
     */
    event Stake(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 indexed block
    );

    /**
     * @notice Emitted when token unstaking is initiated.
     * @param tokenId Identifier for the token being unstaked.
     * @param owner The token owner who wants to unstake the token.
     * @param block The block number at the time of unstaking.
     */
    event Unstake(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 indexed block
    );

    /**
     * @notice Stake the token, disabling marketplace transfers.
     * @param tokenId The unique token identifier.
     */
    function stake(uint256 tokenId) external;

    /**
     * @notice Unstake the token, enabling marketplace transfers.
     * @param tokenId The unique token identifier.
     */
    function unstake(uint256 tokenId) external;
}
```

Every contract compliant with this token reputation EIP MusT also use the feature detection functionality of EIP-165 such that calling `function supportsInterface(bytes4 interfaceID) external view returns (bool)` with `interfaceID` of `0x88832242` MUST return `true`. As EIP-165 and EIP-721 are also required, an example is provided below:

```solidity
function supportsInterface(bytes4 interfaceID) external view returns (bool) {
    return
        interfaceID == 0x01ffc9a7 || // ERC-165 support
        interfaceID == 0x80ac58cd || // ERC-721 support
        interfaceID == 0x88832242;   // Token reputation support
}
```

### Disable or Enable Trading

The `Stake` and `Unstake` events SHOULD be used by off-chain marketplaces to disable/enable trading of a token, which is already used by OpenSea today. Upon a `Stake` event, the `tokenId` can be used to disable trading the specified token. With an `Unstake` emittance, trading is then enabled. By default, an NFT that has not been staked yet will have trading enabled.

### Metadata Definition

The RECOMMENDED metadata format for reputation is defined below. Implementing this metadata is OPTIONAL and up to the implementor, and since events signal staking and unstaking actions, the metadata SHOULD dynamically update upon these events being emitted. For example, a common NFT metadata standard is the following, which would place the `Reputation` score within the `attributes` array:

```json
{
  // ...
  "attributes": [
    {
      "display_type": "number",
      "trait_type": "Reputation",
      "value": 123 // Calculated reputation score, e.g., difference between stake/unstake block numbers
    }
    // ...
  ]
}
```

A benefit of the `Stake` and `Unstake` events is that they include the `address` parameter along with the `tokenId` and `block` number. This is a unique feature in that the token can act as a proxy to reputation earned. That is, from a metadata perspective, the implementor could choose to track _both_ the reputation earned that's tied to the specific token ID and/or the address that owned the token. Since there are no default limitations on selling a reputation token while it is **not staked**, one could create a transferrable reputation system or choose to block transferability altogether, if desired. Again, this proposal tries to enable the maximum amount of flexibility.

## Rationale

The approach outlined in this EIP was designed to be as lightweight as possible and only stakes or unstakes a token, emits an event to disable/enable trading, and also allow for recreating token state through the DA layer. It is a generalized implementation and leaves reputation calculation up to the implementor but provides enough context to do so through the defined events.

## Backwards Compatibility

This standard is compatible with [ERC-721](https://eips.ethereum.org/EIPS/eip-721).

## Reference Implementation

Provided is a simple example how token reputation might be implemented with a very minimal `stake()` and `unstake()` implementation that simply emits a `Stake` or `Unstake` event after a token ownership check:

```solidity
// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./ITokenReputation.sol";

contract TokenReputation is ERC721, ITokenReputation {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    constructor() ERC721("Tableland", "TBL") {}

    function _baseURI() internal pure override returns (string memory) {
        return "https://tableland.xyz/";
    }

    function mint() external payable {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(_msgSender(), tokenId);
    }

    function stake(uint256 tokenId) external {
        address tokenOwner = _ownerOf(tokenId);
        require(_msgSender() == tokenOwner, "UNAUTHORIZED"); // Only token owner can stake
        emit Stake(tokenId, tokenOwner, block.number);
    }

    function unstake(uint256 tokenId) external {
        address tokenOwner = _ownerOf(tokenId);
        require(_msgSender() == tokenOwner, "UNAUTHORIZED"); // Only token owner can unstake
        emit Unstake(tokenId, tokenOwner, block.number);
    }

    function supportsInterface(bytes4 interfaceID) public view override(ERC721) returns (bool) {
        return
            super.supportsInterface(interfaceID) || // Both ERC-165 & ERC-721 support
            interfaceID == 0x88832242; // Token reputation support
    }
}
```

Upon `staking()` and `unstaking()`, the metadata can materialize what is described in the event and update the reputation accordingly. Perhaps the owner successfully staked and unstaked their token, and during this period, there were `500` blocks that passed. Upon additional staking/unstaking events, this score SHOULD be updated—e.g., maybe the next staking session is `1000` blocks, so the `value` below would be updated to `1500`:

```json
{
  "attributes": [
    {
      "display_type": "number",
      "trait_type": "Reputation",
      "value": 500
    }
  ]
}
```

A more complex use case could be a reputation-based application that uses token reputation as a way to define proposal voting and weights that correspond to each token's reputation. Here, the contract implements more specific off-chain functionality for updating the reputation score. Namely, the reputation metadata is materialized off-chain and dynamically updated upon new `Stake` and `Unstake` events, such with IPFS or an SQL database that stores the metadata:

```solidity
// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@tableland/evm/contracts/utils/SQLHelpers.sol";
import "@tableland/evm/contracts/utils/TablelandDeployments.sol";
import "./ITokenReputation.sol";

contract TokenReputation is ERC721, ITokenReputation {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    uint256 private _tokenRepTableId; // Some reference used off-chain to store reputation data
    string private constant _REPUTATION_PREFIX = "token_rep"; // Used off-chain but stored for interoperability purposes

    constructor() ERC721("Tableland", "TBL") {
        _tokenRepTableId = TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema( // Some off-chain SQL database table schema
                "id INTEGER PRIMARY KEY," // Track a staking session ID
                "token_id INTEGER NOT NULL," // The specific token ID
                "owner text NOT NULL," // The address that owns the token at that point in time
                "start_time INTEGER NOT NULL," // Starting block for staking activity via `stake()`
                "end_time INTEGER", // Ending block for staking activity via `unstake()`
                _REPUTATION_PREFIX // Some off-chain SQL database table name
            )
        );
    }

    function _baseURI() internal view override returns (string memory) {
        return string.concat(
            "https://tableland.network/api/v1/query?unwrap=true&extract=true&statement=select%20json_object(%27attributes%27,json_array(json_object(%27display_type%27,%27number%27,%27trait_type%27,%27Reputation%27,%27value%27,end_time-start_time)))%20from%20",
            SQLHelpers.toNameFromId(_REPUTATION_PREFIX, _tokenRepTableId),
            "%20where%20token_id%20%3D%20"
        );
    }

    function mint() external payable {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(_msgSender(), tokenId);
    }

    function stake(uint256 tokenId) external {
        address tokenOwner = _ownerOf(tokenId);
        require(_msgSender() == tokenOwner, "UNAUTHORIZED"); // Token owner or delegate can stake

        // Track the staking session with some off-chain metadata
        TablelandDeployments.get().mutate(
            address(this),
            _tokenRepTableId,
            SQLHelpers.toInsert(
                _REPUTATION_PREFIX,
                _tokenRepTableId,
                "token_id,owner,start_time",
                string.concat(
                    Strings.toString(uint64(tokenId)), // Some implementation-specific casting
                    ",",
                    SQLHelpers.quote(Strings.toHexString(tokenOwner)), // Track reputation for the token owner
                    ",",
                    Strings.toString(uint64(block.number)) // Track the staking block number starting point
                )
            )
        );
        emit Stake(tokenId, tokenOwner, block.number);
    }

    function unstake(uint256 tokenId) external {
        address tokenOwner = _ownerOf(tokenId);
        require(_msgSender() == tokenOwner, "UNAUTHORIZED"); // Token owner or delegate can unstake

        // Update the metadata's `end_time` to accrue block-based reputation, ending at the current `block.number`
        string memory setters = string.concat(
            "end_time=",
            Strings.toString(uint64(block.number))
        );
        // Only update the row with the matching `token_id` and without an `end_time` (i.e., unfinished staking session)
        string memory filters = string.concat(
            "token_id=",
            Strings.toString(uint64(tokenId)),
            " AND ",
            "end_time IS NULL"
        );
        // Update the token reputation data by ending the current block-based staking session
        TablelandDeployments.get().mutate(
            address(this),
            _tokenRepTableId,
            SQLHelpers.toUpdate(
                _REPUTATION_PREFIX,
                _tokenRepTableId,
                setters,
                filters
            )
        );
        emit Unstake(tokenId, tokenOwner, block.number);
    }

    function supportsInterface(bytes4 interfaceID) public view override(ERC721) returns (bool) {
        return
            super.supportsInterface(interfaceID) || // Both ERC-165 & ERC-721 support
            interfaceID == 0x88832242; // Token reputation support
    }

    function onERC721Received(address, address, uint256, bytes calldata) public pure returns (bytes4) {
        return 0x150b7a02; // Allows this reputation contract to own NFTs, which may be useful in certain cases
    }
}
```

## Security Considerations

The same security considerations as [ERC-721](https://eips.ethereum.org/EIPS/eip-721) apply.

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).
