---
title: Token-based reputation
description: A minimal ERC-721 extension for token-based reputation.
author: Daniel Buchholz (@dtbuchholz) <dan@tableland.xyz>, Sander Pick (@sanderpick) <sander@tableland.xyz>, datadanne (@datadanne_eth)
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
- Dynamic metadata changes, signaled by `Stake` and `Unstake` events, are materialized in the metadata by the implementer (OPTIONAL) using the Data Availability ("DA") layer.

For example, a token owner may stake or unstake their token to signal their support/disapproval for a project. Currently, there does not exist a lightweight standard for implementing these signals, which leads to disparate implementations and an overall lack of interoperable reputation across different communities. This proposal aims to standardize a set of staking/unstaking events, methods, and OPTIONAL dynamic metadata attributes that correspond to reputation earned by the token owner.

Note there are two existing EIPs that have somewhat of a similar approach but come with flaws from the perspective of generalizing an interface for the broadest set of use cases:

- [EIP-5192](https://eips.ethereum.org/EIPS/eip-5192): Designed for non-transferrable "soulbound" tokens ("SBT"), EIP-5192 has a few features that do not align with the token reputation requirements:
  - Lacks a way to initiate _both_ staking and unstaking actions through standardized method calls—it only provides a `locked` getter method, which is unneeded for many use cases.
  - Lack of indexed event parameters needed for the metadata for the caller (e.g., token owner) address.
  - Potentially misleading nomenclature if used for non-SBT use cases, whereas "staking" is more applicable to not only reputation-based scenarios but is also widely adopted elsewhere.
- [EIP-5753](https://eips.ethereum.org/EIPS/eip-5753): Although EIP-5753 is currently a draft and yet to be accepted, it (essentially) changes EIP-5192 with the following:
  - Adds `lock` and `unlock` methods, which behave similar to the token reputation proposal's `stake` and `unstake` methods; however, `unlock` lacks the required method caller information, as do the `Lock` and `Unlock` events.
  - Changes the EIP-5192 `locked` getter to a function named `getLocked` that returns an address instead of boolean; but, getters SHOULD NOT be required for a minimal interface as this assumes contract storage is used to track reputation, which is not always the case (e.g., off-chain metadata/DA based reputation tracking).

For reputation to dynamically change the metadata, there SHOULD be a block number associated with the event emittance for off-chain indexing as this is needed to materialize any metadata updates that depend on block-related information. The block number is always included in a blockchain transaction and can be parsed from there. This is being noted due to the block number's relationship to staking; reputation is often tracked with a start and end block number that bound the staking/unstaking activities.

For reference, [OpenSea](https://docs.opensea.io/docs/metadata-standards#disable-trading-for-staked-or-locked-tokens) leverages both of the events noted in EIP-5192 and EIP-5753 to disable trading for staked/locked tokens. There are other accepted events by OpenSea, including the `Stake` and `Unstake` events outlined in this proposal, which _do not_ have an EIP associated with them. Although it is not necessarily the primary motivation of this token reputation EIP, it's been noted to demonstrate how marketplaces are using this EIP's event definitions today. In other words, it is true that the events outlined in this proposal **will disable/enable trading a token on marketplaces**; this proposal _already_ has real-world usage.

### Transferrable vs. Non-Transferrable

Generally, there are two ways to approach reputation: transferrable or non-transferrable. This EIP gives flexibility as to how reputation is treated and results in a broader use case surface area. With the `Stake` and `Unstake` events, there is information about both the token ID and current owner's address; the metadata is ultimately what stores this information. It brings a unique design advantage because it allows the NFT to simply be a _reputation proxy_ where the implementor aggregates reputation tied to a specific owner's _address_. Alternatively, the _token ID_ and that alone could be used. Reputation can either be an address-bound or token-bound.

If reputation **SHOULD NOT be transferrable** (e.g., reputation SHOULD be earned for only a single owner of a token), then this EIP's events give the implementor the data needed to query reputation tied only to an address currently or previously owned a token. This would ensure reputation is no longer transferrable, which is common for credentialing systems. For example, an event `Stake(1, '0x1234...')` emitted at `block.number` value of `100` and `Unstake(1, '0x1234...')` at `block.number` value of `175` could translate to `75` (175-100=75) reputation-related blocks to have accrued for address `0x1234...`.

On the contrary, if reputation is tied to the NFT token ID and not a single address, then it actually opens up a new set of opportunities for value creation through **reputation transferability**. Namely, take the snippet above but calculate reputation for token ID `1` instead of address `0x1234...`. In terms of real-world applications, gaming is a great example. One might earn some reputation that's bound to the token ID, and this unlocks a set of new features that are not available to tokens with a lower reputation; a token-gated workflow. As the token owner, they can choose to sell the token for all of the work they've put in. The tokens with more reputation are more valuable and come with transferrable game state. Furthermore, the owner could even choose to participate in more complex activities, like temporarily delegating/allowing another account to own the token (e.g., rent/escrow) and profit from the reputation earned.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

### Stake and Unstake

An owner SHALL be able to "soft" stake and unstake their token. Staking and unstaking a token SHOULD NOT require a change to the ownership of the token itself but simply emit events that signal the on-chain action taken. Staking a token with `function stake(...)` signals that the owner is staking their token to accrue reputation, such as earning block-based rewards, while the token cannot be sold during this state; reputation SHOULD be earned for good behavior during this token state. Unstaking a token with `function unstake(...)` signals that the owner no longer wishes to stake the token and is available to be sold; reputation SHOULD NOT be earned while in an unstaked state.

The following defines the function signatures for these methods:

- `function stake(uint256 tokenId) external;`
- `function unstake(uint256 tokenId) external;`

These functions emit `Stake` and `Unstake` events, respectively, to signal a change in state of the token. This allows for off-chain marketplaces to change listing behavior as well as the token's metadata to be dynamically changed; the metadata SHOULD be changed by the implementer upon event emittance, but is is entirely OPTIONAL. Namely, there is no required contract storage for token reputation, so the events and metadata are what actually SHOULD store reputation, as provided by the DA layer. The implementor can choose to store reputation in contract storage, if desired. It is a key design component as this keeps the interface as lightweight as possible while also ensuring there is not a lossy process for determining a token's reputation fully off-chain.

The following defines the signatures for these events:

- `event Stake(uint256 indexed tokenId, address indexed owner);`
- `event Unstake(uint256 indexed tokenId, address indexed owner);`

### Token Reputation Interface

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
     */
    event Stake(uint256 indexed tokenId, address indexed owner);

    /**
     * @notice Emitted when token unstaking is initiated.
     * @param tokenId Identifier for the token being unstaked.
     * @param owner The token owner who wants to unstake the token.
     */
    event Unstake(uint256 indexed tokenId, address indexed owner);

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

Every contract compliant with this token reputation EIP MUST also use the feature detection functionality of EIP-165 such that calling `function supportsInterface(bytes4 interfaceID) external view returns (bool)` with `interfaceID` of `0x88832242` MUST return `true`. As EIP-165 and EIP-721 are also required, an example is provided below:

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

The RECOMMENDED metadata format for reputation is defined below. Implementing this metadata is OPTIONAL and up to the implementor, and since events signal staking and unstaking actions, the metadata SHOULD dynamically update upon these events being emitted. For example, a common NFT metadata standard includes the following, which would place the `Reputation` score as a trait within the `attributes` array:

```json
{
  // ...
  "attributes": [
    {
      "display_type": "number",
      "trait_type": "Reputation",
      "value": 123 // Calculated reputation score
    }
    // ...
  ]
}
```

For example, the calculated reputation score could be the cumulative difference between sequential `Stake`->`Unstake` block numbers.

A benefit of the `Stake` and `Unstake` events is that they include the `address` parameter along with the `tokenId`, and the block number is part of the transaction itself. This is a unique feature in that the token can act as a proxy to reputation earned. That is, from a metadata perspective, the implementor could choose to track _both_ the reputation earned that's tied to the specific token ID and/or the address that owned the token. Since there are no default limitations on selling a reputation token while it is **not staked**, one could create a transferrable reputation system or choose to block transferability altogether, if desired. Again, this proposal tries to enable the maximum amount of flexibility.

### Systematic Example

There are various ways in which reputation could stored and tracked. Since NFT metadata is highly structured, an SQL database is often used and could be implemented to listen to the on-chain `Stake` and `Unstake` events, materialize the data, and then allow for metadata queries. That is, each event would mutate the database. Expanding upon the two categorizations mentioned above (transferrable vs. non-transferrable reputation), one could do the following in this off-chain database where a table is created, values are inserted upon `Stake` events, the row is updated upon a subsequent `Unstake` event, and reputation queries are made for a specific address:

```sql
/* Example: tracking reputation using sessions */

/* Create a table to track reputation */
CREATE TABLE token_reputation (
  id INTEGER PRIMARY KEY, /* Session ID */
  token_id INTEGER NOT NULL, /* NFT token ID */
  owner TEXT NOT NULL, /* Token owner's address */
  start_time INTEGER NOT NULL, /* Starting block number */
  end_time INTEGER /* Ending block number */
);

/* Process event at `block.number` value of `100`: `Stake(1, '0x1234...')` */
INSERT INTO
  token_reputation (token_id, owner, start_time)
VALUES
  (1, '0x1234...', 100);

/* Process event at `block.number` value of `175`: `Unstake(1, '0x1234...')` */
UPDATE
  token_reputation SET end_time = 175
WHERE
  token_id = 1 AND
  owner = '0x1234...' AND
  end_time IS NULL;

/* Query reputation for address `0x1234...` */
SELECT
  SUM(end_time - start_time)
FROM
  token_reputation
WHERE
  owner = '0x1234...';
/* Returns a reputation value of: 75 */
```

Within the metadata, the calculated reputation value can then be displayed as an attribute. The query above demonstrates address-bound (non-transferrable) reputation. For token-bound (transferrable) reputation, the overall structure would be quite similar but drops the `owner` column and also changes the `SELECT` query such that is uses `token_id = 1` instead of `owner = '0x1234...'` in the `WHERE` clause. One could even imagine more complex use cases where other structured data is included within implementation-specific events and materialized in the SQL table, such as in-game points, wins/losses, or similar.

## Rationale

The approach outlined in this EIP was designed to be as lightweight as possible and only stakes or unstakes a token, emits an event to disable/enable trading, and also allow for recreating token state through the DA layer. It is a generalized implementation and leaves reputation calculation up to the implementor but provides enough context to do so through the defined events.

## Backwards Compatibility

This standard is compatible with [ERC-721](https://eips.ethereum.org/EIPS/eip-721).

## Reference Implementation

Provided is a simple example of how token reputation might be implemented with a very minimal `stake()` and `unstake()` implementation. These methods check token ownership and the current staking status, using a simple `_status` mapping, before emitting a `Stake` or `Unstake` event. Namely, it prevents staking if a token is currently staked _or_ prevents unstaking if a token currently unstaked.

```solidity
// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./ITokenReputation.sol";

contract TokenReputation is ERC721, ITokenReputation {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter; // Incrementor for the token ID
    mapping(uint256 => bool) private _status; // Track the token's staking status: `true` (staked) or `false` (unstaked)

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
        require(_status[tokenId] == false, "INVALID STATUS"); // Only currently unstaked tokens can be staked
        _status[tokenId] = true;
        emit Stake(tokenId, tokenOwner);
    }

    function unstake(uint256 tokenId) external {
        address tokenOwner = _ownerOf(tokenId);
        require(_msgSender() == tokenOwner, "UNAUTHORIZED"); // Only token owner can unstake
        require(_status[tokenId] == true, "INVALID STATUS"); // Only currently staked tokens can be unstaked
        _status[tokenId] = false;
        emit Unstake(tokenId, tokenOwner);
    }

    function supportsInterface(
        bytes4 interfaceID
    ) public view override(ERC721) returns (bool) {
        return
            super.supportsInterface(interfaceID) || interfaceID == 0x88832242; // Ensure ERC-165, ERC-721, & token reputation support
    }
}
```

Upon `staking()` and `unstaking()`, the metadata can materialize what is described in the event and update the reputation accordingly. Perhaps the owner successfully staked and unstaked their token, and during this period, there were `75` blocks that passed—the metadata could be updated to reflect this:

```json
{
  "attributes": [
    {
      "display_type": "number",
      "trait_type": "Reputation",
      "value": 75
    }
  ]
}
```

### Complex Usage

A more complex use case could be a reputation-based application that uses each token's score to calculate, for example, voting weights for a token-gated proposal. Here, the contract implements more specific off-chain functionality for updating the reputation score. The reputation metadata is materialized off-chain and dynamically updated upon new `Stake` and `Unstake` events, such as with IPFS or an SQL database that stores the metadata.

```solidity
// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.10 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@tableland/evm/contracts/utils/SQLHelpers.sol";
import "@tableland/evm/contracts/utils/TablelandDeployments.sol";
import "./ITokenReputation.sol";

contract Template is ERC721, ITokenReputation {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter; // Incrementor for the token ID
    mapping(uint256 => bool) private _status; // Track the token's staking status: `true` (staked) or `false` (unstaked)
    uint256 private _tokenRepTableId; // Some reference used off-chain to store reputation data
    string private constant _REPUTATION_PREFIX = "token_reputation"; // Used off-chain but stored for interoperability purposes
    string private _baseURIString; // Base URI for metadata (set on deployment)

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
        _baseURIString = "https://tableland.network/api/v1/query?unwrap=true&extract=true&statement=";
    }

    function _baseURI() internal view override returns (string memory) {
        return
            string.concat(
                _baseURIString,
                "select%20json_object(%27attributes%27,json_array(json_object(%27display_type%27,%27number%27,%27trait_type%27,%27Reputation%27,%27value%27,SUM(end_time-start_time))))%20from%20",
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
        require(_status[tokenId] == false, "INVALID STATUS"); // Only currently unstaked tokens can be staked
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
        _status[tokenId] = true;
        emit Stake(tokenId, tokenOwner);
    }

    function unstake(uint256 tokenId) external {
        address tokenOwner = _ownerOf(tokenId);
        require(_msgSender() == tokenOwner, "UNAUTHORIZED"); // Token owner or delegate can unstake
        require(_status[tokenId] == true, "INVALID STATUS"); // Only currently staked tokens can be unstaked
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
            "owner=",
            SQLHelpers.quote(Strings.toHexString(tokenOwner)),
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
        _status[tokenId] = false;
        emit Unstake(tokenId, tokenOwner);
    }

    function supportsInterface(
        bytes4 interfaceID
    ) public view override(ERC721) returns (bool) {
        return
            super.supportsInterface(interfaceID) || interfaceID == 0x88832242; // Ensure ERC-165, ERC-721, & token reputation support
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) public pure returns (bytes4) {
        return 0x150b7a02; // Allows this reputation contract to own NFTs, which may be useful in certain cases
    }
}
```

Note this example provides a working implementation where any `tokenURI` method call will construct/serve the aforementioned `attributes` array with the dynamically updated reputation score. The `tokenURI` query could be further customized and extended for full ERC721 metadata compliance.

## Security Considerations

The same security considerations as [ERC-721](https://eips.ethereum.org/EIPS/eip-721) apply.

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).
