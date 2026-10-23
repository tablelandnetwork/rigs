import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import { AllowList, buildTree, hashEntry } from "../helpers/allowlist";
import { getURITemplate, normalize } from "../helpers/uris";
import { PaymentSplitter, TablelandRigs } from "../typechain-types";

chai.use(chaiAsPromised);
const expect = chai.expect;
const assert = chai.assert;

function getCost(quantity: number, price: number): BigNumber {
  return utils.parseEther((quantity * price).toFixed(2));
}

describe("Rigs", function () {
  // Rigs contract deployment
  let rigs: TablelandRigs;
  let splitter: PaymentSplitter;
  let accounts: SignerWithAddress[];
  let beneficiary: SignerWithAddress;
  const allowlist: AllowList = {};
  const waitlist: AllowList = {};
  let allowlistTree: MerkleTree;
  let waitlistTree: MerkleTree;

  // Use a fixture, which runs *once* to help ensure deterministic contract addresses
  async function deployRigsFixture() {
    // Account setup
    accounts = await ethers.getSigners();
    beneficiary = accounts[1];
    accounts.slice(0, 5).forEach((a: SignerWithAddress, i: number) => {
      allowlist[a.address] = {
        freeAllowance: i + 1,
        paidAllowance: i + 1,
      };
    });
    allowlistTree = buildTree(allowlist);
    expect(allowlistTree.getLeafCount()).to.equal(5);

    // Include an address that is on allowlist and waitlist
    accounts.slice(4, 10).forEach((a: SignerWithAddress, i: number) => {
      waitlist[a.address] = {
        freeAllowance: i + 1,
        paidAllowance: i + 1,
      };
    });
    waitlistTree = buildTree(waitlist);
    expect(waitlistTree.getLeafCount()).to.equal(6);

    // Deploy the Rigs contract and its dependencies
    const SplitterFactory = await ethers.getContractFactory("PaymentSplitter");
    splitter = (await SplitterFactory.deploy(
      [accounts[2].address, accounts[3].address],
      [20, 80]
    )) as PaymentSplitter;
    await splitter.deployed();
    const RigsFactory = await ethers.getContractFactory("TablelandRigs");
    rigs = await ((await RigsFactory.deploy()) as TablelandRigs).deployed();
    await (
      await rigs.initialize(
        BigNumber.from(3000),
        utils.parseEther("0.05"),
        beneficiary.address,
        splitter.address,
        allowlistTree.getHexRoot(),
        waitlistTree.getHexRoot()
      )
    ).wait();
    await rigs.setContractURI("https://foo.xyz");
    await rigs.setURITemplate(["https://foo.xyz/", "/bar"]);

    // Check can only init once
    await expect(
      rigs.initialize(
        BigNumber.from(3000),
        utils.parseEther("0.05"),
        beneficiary.address,
        splitter.address,
        allowlistTree.getHexRoot(),
        waitlistTree.getHexRoot()
      )
    ).to.be.revertedWith(
      "ERC721A__Initializable: contract is already initialized"
    );
  }

  beforeEach(async function () {
    // Deploy the `TablelandRigs` contract
    await loadFixture(deployRigsFixture);
  });

  describe("Deployment and minting", function () {
    it("Should not mint during closed phase", async function () {
      // try public minting
      let minter = accounts[10];
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, { value: getCost(1, 0.05) })
      ).to.be.rejectedWith("MintingClosed");

      // try allowlist minting
      minter = accounts[4];
      const entry = allowlist[minter.address];
      const proof = allowlistTree.getHexProof(hashEntry(minter.address, entry));
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            {
              value: getCost(1, 0.05),
            }
          )
      ).to.be.rejectedWith("MintingClosed");
    });

    it("Should not mint with zero quantity", async function () {
      await rigs.setMintPhase(3);
      const minter = accounts[10];
      await expect(rigs.connect(minter)["mint(uint256)"](0)).to.be.rejectedWith(
        "ZeroQuantity"
      );
    });

    it("Should mint with allowlist during allowlist phase", async function () {
      await rigs.setMintPhase(1);

      // try public minting
      let minter = accounts[10];
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, { value: getCost(1, 0.05) })
      ).to.be.rejectedWith("InvalidProof");

      // mint one of free allowance
      minter = accounts[4];
      let entry = allowlist[minter.address];
      let proof = allowlistTree.getHexProof(hashEntry(minter.address, entry));
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof
          )
      )
        .to.emit(rigs, "Transfer")
        .withArgs(
          ethers.constants.AddressZero,
          minter.address,
          BigNumber.from(1)
        );

      // check new balance
      expect(await rigs.balanceOf(minter.address)).to.equal(BigNumber.from(1));

      // check owned tokens
      let tokens = await rigs.tokensOfOwner(minter.address);
      expect(tokens.length).to.equal(1);
      expect(tokens[0]).to.equal(BigNumber.from(1));

      // check total supply
      expect(await rigs.totalSupply()).to.equal(BigNumber.from(1));

      // minting over free allowance should require ether
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            entry.freeAllowance,
            entry.freeAllowance,
            entry.paidAllowance,
            proof
          )
      ).to.be.rejectedWith("InsufficientValue(50000000000000000)");

      // mint remaining free allowance
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            entry.freeAllowance - 1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof
          )
      ).to.emit(rigs, "Transfer");

      // mint all paid allowance allowance
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            entry.paidAllowance,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            {
              value: getCost(entry.paidAllowance, 0.05),
            }
          )
      )
        .to.emit(rigs, "Transfer")
        .to.emit(rigs, "Revenue")
        .withArgs(
          beneficiary.address,
          BigNumber.from(entry.paidAllowance),
          getCost(entry.paidAllowance, 0.05)
        )
        .to.not.emit(rigs, "Refund");

      // re-check owned tokens
      tokens = await rigs.tokensOfOwner(minter.address);
      expect(tokens.length).to.equal(10);

      // check allowance is now exhausted
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            {
              value: getCost(1, 0.05),
            }
          )
      ).to.be.rejectedWith("InsufficientAllowance");

      // Check claimed count
      const claimed = await rigs.getClaimed(minter.address);
      expect(claimed.allowClaims).to.equal(
        entry.freeAllowance + entry.paidAllowance
      );
      expect(claimed.waitClaims).to.equal(0);

      // try waitlist minting
      minter = accounts[5];
      entry = waitlist[minter.address];
      proof = waitlistTree.getHexProof(hashEntry(minter.address, entry));
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            {
              value: getCost(1, 0.05),
            }
          )
      ).to.be.rejectedWith("InvalidProof");
    });

    it("Should mint with waitlist during waitlist phase", async function () {
      await rigs.setMintPhase(2);

      // try public minting
      let minter = accounts[10];
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, { value: getCost(1, 0.05) })
      ).to.be.rejectedWith("InvalidProof");

      // mint all allowance and send extra ether
      minter = accounts[5];
      const entry = waitlist[minter.address];
      const proof = waitlistTree.getHexProof(hashEntry(minter.address, entry));
      const quantity = entry.freeAllowance + entry.paidAllowance + 1;
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            quantity,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            {
              value: getCost(quantity, 0.05),
            }
          )
      )
        .to.emit(rigs, "Transfer")
        .to.emit(rigs, "Revenue")
        .withArgs(
          beneficiary.address,
          BigNumber.from(entry.paidAllowance),
          getCost(entry.paidAllowance, 0.05)
        )
        .to.emit(rigs, "Refund")
        .withArgs(
          minter.address,
          getCost(quantity - entry.paidAllowance, 0.05)
        );

      // check allowance is now exhausted
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            {
              value: getCost(1, 0.05),
            }
          )
      ).to.be.rejectedWith("InsufficientAllowance");

      // Check claimed count
      const claimed = await rigs.getClaimed(minter.address);
      expect(claimed.allowClaims).to.equal(0);
      expect(claimed.waitClaims).to.equal(
        entry.freeAllowance + entry.paidAllowance
      );

      // try unused allowlist
      minter = accounts[3];
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            {
              value: getCost(1, 0.05),
            }
          )
      ).to.be.rejectedWith("InvalidProof");
    });

    it("Should mint during public phase", async function () {
      await rigs.setMintPhase(3);

      let minter = accounts[10];
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, { value: getCost(1, 0.05) })
      ).to.emit(rigs, "Transfer");

      // allowlist minting should not allow free minting
      minter = accounts[4];
      const entry = allowlist[minter.address];
      const proof = allowlistTree.getHexProof(hashEntry(minter.address, entry));
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof
          )
      ).to.be.rejectedWith("InsufficientValue");

      // allowlist minting should still work with value
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            1,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            { value: getCost(1, 0.05) }
          )
      ).to.emit(rigs, "Transfer");
    });

    it("Should mint through phases until sold out", async function () {
      const maxSupply = await rigs.maxSupply();

      // allowlist
      await rigs.setMintPhase(1);
      let minter = accounts[4];
      let entry = allowlist[minter.address];
      let proof = allowlistTree.getHexProof(hashEntry(minter.address, entry));
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            entry.freeAllowance + entry.paidAllowance,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            { value: getCost(entry.paidAllowance, 0.05) }
          )
      ).to.emit(rigs, "Transfer");
      let minted = entry.freeAllowance + entry.paidAllowance;

      // Check claimed count
      let claimed = await rigs.getClaimed(minter.address);
      expect(claimed.allowClaims).to.equal(
        entry.freeAllowance + entry.paidAllowance
      );
      expect(claimed.waitClaims).to.equal(0);

      // waitlist, same address
      await rigs.setMintPhase(2);
      minter = accounts[4];
      entry = waitlist[minter.address];
      proof = waitlistTree.getHexProof(hashEntry(minter.address, entry));
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            entry.freeAllowance + entry.paidAllowance,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            { value: getCost(entry.paidAllowance, 0.05) }
          )
      ).to.be.rejectedWith("InsufficientAllowance");

      // waitlist
      await rigs.setMintPhase(2);
      minter = accounts[5];
      entry = waitlist[minter.address];
      proof = waitlistTree.getHexProof(hashEntry(minter.address, entry));
      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](
            entry.freeAllowance + entry.paidAllowance,
            entry.freeAllowance,
            entry.paidAllowance,
            proof,
            { value: getCost(entry.paidAllowance, 0.05) }
          )
      ).to.emit(rigs, "Transfer");
      minted += entry.freeAllowance + entry.paidAllowance;

      // Check claimed count
      claimed = await rigs.getClaimed(minter.address);
      expect(claimed.allowClaims).to.equal(0);
      expect(claimed.waitClaims).to.equal(
        entry.freeAllowance + entry.paidAllowance
      );

      // public
      await rigs.setMintPhase(3);
      minter = accounts[10];
      const remaining = maxSupply.toNumber() - minted;
      await expect(
        rigs.connect(minter)["mint(uint256)"](remaining, {
          value: getCost(remaining, 0.05),
        })
      ).to.emit(rigs, "Transfer");
      minted += remaining;

      // sold out
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, {
          value: getCost(1, 0.05),
        })
      ).to.be.rejectedWith("SoldOut");

      assert.equal(maxSupply.toNumber(), minted);
    });

    it("Should set URI template", async function () {
      await rigs.setMintPhase(3);

      const minter = accounts[10];
      const tx = await rigs
        .connect(minter)
        ["mint(uint256)"](1, { value: getCost(1, 0.05) });
      const receipt = await tx.wait();
      const [event] = receipt.events ?? [];
      const tokenId = event.args?.tokenId;

      await rigs.setURITemplate([]);
      expect(await rigs.tokenURI(tokenId)).to.equal("");

      await rigs.setURITemplate([""]);
      expect(await rigs.tokenURI(tokenId)).to.equal("");

      await rigs.setURITemplate(["https://fake.com/"]);
      expect(await rigs.tokenURI(tokenId)).to.equal("https://fake.com/");

      await rigs.setURITemplate(["https://fake.com/", "/boo"]);
      expect(await rigs.tokenURI(tokenId)).to.equal("https://fake.com/1/boo");

      await rigs.setURITemplate(["https://fake.com/", "/boo/", ""]);
      expect(await rigs.tokenURI(tokenId)).to.equal("https://fake.com/1/boo/1");
    });

    it("Should have pending metadata if no attributeTable", async function () {
      const tablelandHost = "http://tableland.network";
      const table1 = "table1";
      const table2 = "table2";
      const table3 = "table3";
      const table4 = "table4";
      const table5 = "table5";
      const uriTemplate = await getURITemplate(
        tablelandHost,
        table1,
        table2,
        table3,
        table4,
        table5,
        false
      );
      const uri = new URL(uriTemplate.join("1"));
      const statement = uri.searchParams.get("statement");
      /* eslint-disable no-unused-expressions */
      expect(statement).not.to.be.null;
      // normalizing the statement checks that it is valid SQL, will throw
      // an error if it isn't
      const normalizedStatement = await normalize(statement!);
      expect(normalizedStatement).contains("pre-reveal");
    });

    it("Should have final metadata if attributeTable", async function () {
      const tablelandHost = "http://tableland.network";
      const table1 = "table1";
      const table2 = "table2";
      const table3 = "table3";
      const table4 = "table4";
      const table5 = "table5";
      const uriTemplate = await getURITemplate(
        tablelandHost,
        table1,
        table2,
        table3,
        table4,
        table5,
        true
      );
      const uri = new URL(uriTemplate.join("1"));
      const statement = uri.searchParams.get("statement");
      /* eslint-disable no-unused-expressions */
      expect(statement).not.to.be.null;
      // normalizing the statement checks that it is valid SQL, will throw
      // an error if it isn't
      const normalizedStatement = await normalize(statement!);
      expect(normalizedStatement).contains("Garage Status");
    });

    it("Should not return token URI for non-existent token", async function () {
      await expect(rigs.tokenURI(BigNumber.from(1))).to.be.rejectedWith(
        "URIQueryForNonexistentToken"
      );
    });

    it("Should set contract URI", async function () {
      await rigs.setContractURI("https://fake.com");

      expect(await rigs.contractURI()).to.equal("https://fake.com");
    });

    it("Should set royalty receiver", async function () {
      const receiver = accounts[2].address;
      await rigs.setRoyaltyReceiver(receiver);

      const info = await rigs.royaltyInfo(1, utils.parseEther("1"));
      expect(info[0]).to.equal(receiver);
      expect(info[1]).to.equal(utils.parseEther("0.05"));
    });

    it("Should pause and unpause minting", async function () {
      await rigs.setMintPhase(3);

      await rigs.pause();

      const minter = accounts[10];
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, { value: getCost(1, 0.05) })
      ).to.be.revertedWith("Pausable: paused");

      await expect(
        rigs
          .connect(minter)
          ["mint(uint256,uint256,uint256,bytes32[])"](1, 0, 0, [], {
            value: getCost(1, 0.05),
          })
      ).to.be.revertedWith("Pausable: paused");

      await rigs.unpause();
    });

    it("Should restrict owner-only methods to owners", async function () {
      const _rigs = rigs.connect(accounts[2]);

      await expect(_rigs.setMintPhase(1)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(
        _rigs.setBeneficiary(accounts[2].address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(_rigs.setURITemplate(["foo"])).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(_rigs.setContractURI("bar")).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(
        _rigs.setRoyaltyReceiver(accounts[2].address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(_rigs.refreshMetadata()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(_rigs.pause()).to.be.rejectedWith(
        "Ownable: caller is not the owner"
      );

      await expect(_rigs.unpause()).to.be.rejectedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should support required interfaces", async function () {
      // ERC165 interface ID for ERC165
      expect(await rigs.supportsInterface("0x01ffc9a7")).to.equal(true);
      // ERC165 interface ID for ERC721
      expect(await rigs.supportsInterface("0x80ac58cd")).to.equal(true);
      // ERC165 interface ID for ERC721Metadata
      expect(await rigs.supportsInterface("0x5b5e139f")).to.equal(true);
      // ERC165 interface ID for ERC2981
      expect(await rigs.supportsInterface("0x2a55205a")).to.equal(true);
      // ERC165 interface ID for ERC4906
      expect(await rigs.supportsInterface("0x49064906")).to.equal(true);
    });
  });

  describe("Retired pilots", function () {
    async function mintRig(minter: SignerWithAddress): Promise<BigNumber> {
      await rigs.setMintPhase(3);
      const tx = await rigs
        .connect(minter)
        ["mint(uint256)"](1, { value: getCost(1, 0.05) });
      const receipt = await tx.wait();
      const [event] = receipt.events ?? [];
      return event.args?.tokenId;
    }

    it("Should allow transfers by approved addresses and operators", async function () {
      const tokenOwner = accounts[4];
      const approved = accounts[5];
      const operator = accounts[6];
      const buyer = accounts[7];
      const tokenId = await mintRig(tokenOwner);

      // Approved address (single token approval)
      await rigs.connect(tokenOwner).approve(approved.address, tokenId);
      await expect(
        rigs
          .connect(approved)
          .transferFrom(tokenOwner.address, buyer.address, tokenId)
      )
        .to.emit(rigs, "Transfer")
        .withArgs(tokenOwner.address, buyer.address, tokenId);
      expect(await rigs.ownerOf(tokenId)).to.equal(buyer.address);

      // Operator (e.g., a marketplace with `setApprovalForAll`)
      await rigs.connect(buyer).setApprovalForAll(operator.address, true);
      await expect(
        rigs
          .connect(operator)
          ["safeTransferFrom(address,address,uint256)"](
            buyer.address,
            tokenOwner.address,
            tokenId
          )
      )
        .to.emit(rigs, "Transfer")
        .withArgs(buyer.address, tokenOwner.address, tokenId);
      expect(await rigs.ownerOf(tokenId)).to.equal(tokenOwner.address);
    });

    it("Should block transfers while paused", async function () {
      const tokenOwner = accounts[4];
      const tokenId = await mintRig(tokenOwner);
      await rigs.pause();
      await expect(
        rigs
          .connect(tokenOwner)
          .transferFrom(tokenOwner.address, accounts[5].address, tokenId)
      ).to.be.revertedWith("Pausable: paused");
      await rigs.unpause();
      await rigs
        .connect(tokenOwner)
        .transferFrom(tokenOwner.address, accounts[5].address, tokenId);
      expect(await rigs.ownerOf(tokenId)).to.equal(accounts[5].address);
    });

    it("Should not expose any pilot or parking admin methods", async function () {
      const tokenOwner = accounts[4];
      const tokenId = await mintRig(tokenOwner);
      const retired = new utils.Interface([
        "function initPilots(address)",
        "function pilotSessionsTable() view returns (string)",
        "function pilotInfo(uint256)",
        "function pilotInfo(uint256[])",
        "function trainRig(uint256)",
        "function trainRig(uint256[])",
        "function pilotRig(uint256,address,uint256)",
        "function pilotRig(uint256[],address[],uint256[])",
        "function parkRig(uint256)",
        "function parkRig(uint256[])",
        "function parkRigAsOwner(uint256[])",
        "function parkRigAsAdmin(uint256[])",
        "function safeTransferWhileFlying(address,address,uint256)",
        "function admin() view returns (address)",
        "function setAdmin(address)",
      ]);
      const calls: [string, unknown[]][] = [
        ["initPilots", [accounts[1].address]],
        ["pilotSessionsTable", []],
        ["pilotInfo(uint256)", [tokenId]],
        ["pilotInfo(uint256[])", [[tokenId]]],
        ["trainRig(uint256)", [tokenId]],
        ["trainRig(uint256[])", [[tokenId]]],
        [
          "pilotRig(uint256,address,uint256)",
          [tokenId, ethers.constants.AddressZero, 0],
        ],
        [
          "pilotRig(uint256[],address[],uint256[])",
          [[tokenId], [ethers.constants.AddressZero], [0]],
        ],
        ["parkRig(uint256)", [tokenId]],
        ["parkRig(uint256[])", [[tokenId]]],
        ["parkRigAsOwner", [[tokenId]]],
        ["parkRigAsAdmin", [[tokenId]]],
        [
          "safeTransferWhileFlying",
          [tokenOwner.address, accounts[5].address, tokenId],
        ],
        ["admin", []],
        ["setAdmin", [accounts[1].address]],
      ];
      const selectors = Object.keys(rigs.interface.functions).map((f) =>
        rigs.interface.getSighash(f)
      );
      for (const [fragment, args] of calls) {
        expect(selectors).to.not.include(retired.getSighash(fragment));
        // Owner calls too, so `onlyOwner` can't be the reason for reverting
        for (const caller of [accounts[0], tokenOwner]) {
          await expect(
            caller.sendTransaction({
              to: rigs.address,
              data: retired.encodeFunctionData(fragment, args),
            })
          ).to.be.reverted;
        }
      }
    });

    it("Should emit a batch metadata refresh for all minted Rigs", async function () {
      await rigs.setMintPhase(3);
      await rigs
        .connect(accounts[4])
        ["mint(uint256)"](3, { value: getCost(3, 0.05) });
      await expect(rigs.refreshMetadata())
        .to.emit(rigs, "BatchMetadataUpdate")
        .withArgs(BigNumber.from(1), BigNumber.from(3));
    });
  });
});
