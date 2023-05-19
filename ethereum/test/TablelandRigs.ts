import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TablelandTables } from "@tableland/evm";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, utils } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { MerkleTree } from "merkletreejs";
import { AllowList, buildTree, hashEntry } from "../helpers/allowlist";
import { getURITemplate, normalize } from "../helpers/uris";
import {
  PaymentSplitter,
  TablelandRigs,
  TablelandRigPilots,
  DelegateCashMock,
} from "../typechain-types";

chai.use(chaiAsPromised);
const expect = chai.expect;
const assert = chai.assert;

const DELEGATE_CASH_ADDRESS = "0x00000000000076a84fef008cdabe6409d2fe638b";

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
  let pilots: TablelandRigPilots;
  let delegateCash: DelegateCashMock;

  // Use a fixture, which runs *once* to help ensure deterministic contract addresses
  async function deployRigsFixture() {
    // First, deploy the `TablelandTables` registry contract
    // Required for creating table from contract in `TablelandRigPilots.initialize()`
    const TablelandTablesFactory = await ethers.getContractFactory(
      "TablelandTables"
    );
    await (
      (await upgrades.deployProxy(
        TablelandTablesFactory,
        ["https://foo.xyz/"],
        {
          kind: "uups",
        }
      )) as TablelandTables
    ).deployed();

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

    // Deploy the Pilots contract
    const PilotsFactory = await ethers.getContractFactory("TablelandRigPilots");
    pilots = await (
      (await PilotsFactory.deploy()) as TablelandRigPilots
    ).deployed();
    await (await pilots.initialize(rigs.address)).wait();

    // Set pilots on rigs
    await (await rigs.initPilots(pilots.address)).wait();

    // Deploy our delegate.cash mock,
    // get the byte code from the deployed mock contract,
    // and set the mock bytecode at the hardcoded delegate.cash address
    const DelegateCashFactory = await ethers.getContractFactory(
      "DelegateCashMock"
    );
    const delegateCashMock = await (
      (await DelegateCashFactory.deploy()) as DelegateCashMock
    ).deployed();
    const mockDelegateCashCode = await network.provider.send("eth_getCode", [
      delegateCashMock.address,
    ]);
    await network.provider.send("hardhat_setCode", [
      DELEGATE_CASH_ADDRESS,
      mockDelegateCashCode,
    ]);

    delegateCash = DelegateCashFactory.attach(
      DELEGATE_CASH_ADDRESS
    ) as DelegateCashMock;
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

  describe("The Garage", function () {
    describe("initPilots", function () {
      it("Should block contract non-owner", async function () {
        const _rigs = rigs.connect(accounts[2]);

        await expect(
          _rigs.initPilots(ethers.constants.AddressZero)
        ).to.be.rejectedWith("Ownable: caller is not the owner");
      });
    });

    describe("pilotSessionsTable", function () {
      it("Should return pilot sessions table", async function () {
        expect(await rigs.pilotSessionsTable()).to.be.equal(
          `pilot_sessions_${network.config.chainId}_2`
        );
      });
    });

    describe("admin", function () {
      it("Owner should be able to set admin", async function () {
        const admin = accounts[2];

        expect(await rigs.admin()).to.not.equal(admin.address);

        await rigs.setAdmin(admin.address);

        expect(await rigs.admin()).to.equal(admin.address);
      });

      it("Non-owner should not be able to set admin", async function () {
        const hacker = accounts[2];

        await expect(
          rigs.connect(hacker).setAdmin(hacker.address)
        ).to.be.rejectedWith("Ownable: caller is not the owner");
      });
    });

    describe("pilotInfo", function () {
      it("Should not return pilot info for non-existent token", async function () {
        // Try calling with a non-existent token
        await expect(
          rigs["pilotInfo(uint256)"](BigNumber.from(0))
        ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
      });

      it("Should get default pilot info for a garaged Rig", async function () {
        // Mint a token and then get its pilot's default info (i.e., still in the garage)
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        const pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(tokenId)
        );
        expect(pilotInfo.status).to.equal(0);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(0));
      });

      it("Should get pilot info for more than one Rig", async function () {
        // Mint 2 tokens
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId1 = event.args?.tokenId;
        tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const tokenId2 = event.args?.tokenId;
        const pilotInfo = await rigs["pilotInfo(uint256[])"]([
          BigNumber.from(tokenId1),
          BigNumber.from(tokenId2),
        ]);
        // Pilot info for tokenId1
        expect(pilotInfo[0].status).to.equal(0);
        expect(pilotInfo[0].pilotable).to.equal(false);
        expect(pilotInfo[0].started).to.equal(BigNumber.from(0));
        expect(pilotInfo[0].addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo[0].id).to.equal(BigNumber.from(0));
        // Pilot info for tokenId2
        expect(pilotInfo[1].status).to.equal(0);
        expect(pilotInfo[1].pilotable).to.equal(false);
        expect(pilotInfo[1].started).to.equal(BigNumber.from(0));
        expect(pilotInfo[1].addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo[1].id).to.equal(BigNumber.from(0));
      });
    });

    describe("stake", function () {
      it("Should not train Rig when paused", async function () {
        await rigs.pause();
        // Try to train a single Rig when paused
        const sender = accounts[4];
        await expect(
          rigs.connect(sender)["stake(uint256)"](BigNumber.from(0))
        ).to.be.revertedWith("Pausable: paused");
        // Try to train a multiple Rigs when paused
        await expect(
          rigs
            .connect(sender)
            ["stake(uint256[])"]([BigNumber.from(0), BigNumber.from(0)])
        ).to.be.revertedWith("Pausable: paused");

        await rigs.unpause();
      });

      it("Should not train Rig for non-existent token", async function () {
        await expect(
          rigs["stake(uint256)"](BigNumber.from(0))
        ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
      });

      it("Should not train Rig if msg.sender is not token owner", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Attempt to train the Rig with an address that doesn't own the token
        const sender = accounts[5];
        await expect(
          rigs.connect(sender)["stake(uint256)"](BigNumber.from(tokenId))
        ).to.be.rejectedWith("Unauthorized");
      });

      it("Should train Rig if msg.sender is token owner", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig
        await expect(
          rigs.connect(tokenOwner)["stake(uint256)"](BigNumber.from(tokenId))
        )
          .to.emit(pilots, "Training")
          .withArgs(BigNumber.from(tokenId));
      });

      it("Should not train Rig if it has already left the garage", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Try to train the Rig again
        await expect(
          rigs.connect(tokenOwner)["stake(uint256)"](BigNumber.from(tokenId))
        ).to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should batch train Rigs", async function () {
        // First, mint 2 Rigs to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId1 = event.args?.tokenId;
        tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const tokenId2 = event.args?.tokenId;
        // Train the Rigs
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256[])"]([
              BigNumber.from(tokenId1),
              BigNumber.from(tokenId2),
            ])
        )
          .to.emit(pilots, "Training")
          .withArgs(BigNumber.from(tokenId1))
          .to.emit(pilots, "Training")
          .withArgs(BigNumber.from(tokenId2));
      });

      it("Should not batch train a duplicate Rig token value", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, but pass the same Rig `tokenId` twice -- the second training attempt will fail
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256[])"]([
              BigNumber.from(tokenId),
              BigNumber.from(tokenId),
            ])
        )
          .to.emit(pilots, "Training")
          .withArgs(BigNumber.from(tokenId))
          .to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should not batch train Rig with empty array or exceeding max length for array", async function () {
        // Try with an empty array
        await expect(rigs["stake(uint256[])"]([])).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
        // Try with an array of tokens exceeding 255 in length (the arbitrary limit)
        const tokenIds = [...Array(256).keys()];
        await expect(rigs["stake(uint256[])"](tokenIds)).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
      });
    });

    describe("pilotRig", function () {
      it("Should not pilot Rig when paused", async function () {
        await rigs.pause();

        // Try to pilot when paused
        await expect(
          rigs["stake(uint256,address,uint256)"](
            BigNumber.from(0),
            ethers.constants.AddressZero,
            BigNumber.from(1)
          )
        ).to.be.rejectedWith("Pausable: paused");
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            [BigNumber.from(0)],
            [ethers.constants.AddressZero],
            [BigNumber.from(1)]
          )
        ).to.be.rejectedWith("Pausable: paused");

        await rigs.unpause();
      });

      it("Should not pilot Rig for non-existent token", async function () {
        // Try with a single Rig and `pilotRig`
        await expect(
          rigs["stake(uint256,address,uint256)"](
            BigNumber.from(0),
            ethers.constants.AddressZero,
            BigNumber.from(1)
          )
        ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
        // Try with multiple Rigs and `pilotRig` (batch)
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            [BigNumber.from(0)],
            [ethers.constants.AddressZero],
            [BigNumber.from(1)]
          )
        ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
      });

      it("Should not pilot Rig if msg.sender is not token owner", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Attempt to pilot the Rig with an address that doesn't own the token
        const sender = accounts[5];
        await expect(
          rigs
            .connect(sender)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(tokenId),
              ethers.constants.AddressZero,
              BigNumber.from(1)
            )
        ).to.be.rejectedWith("Unauthorized");
      });

      it("Should not pilot Rig if pilot id is too big", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Attempt to pilot the Rig with too big pilot id
        await expect(
          rigs.connect(tokenOwner)["stake(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            ethers.utils.hexZeroPad(1, 20), // 0x0...01
            BigNumber.from(Math.pow(2, 32))
          )
        ).to.be.rejectedWith('InvalidCustomPilot("pilot id too big")');
      });

      it("Should not allow non-ERC-721 or Rigs contract for custom pilots", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Try to set the pilot to a non-ERC721 address
        await expect(
          rigs.connect(tokenOwner)["stake(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            ethers.utils.hexZeroPad(1, 20), // 0x0...01
            BigNumber.from(1)
          )
        ).to.be.rejectedWith(
          'InvalidCustomPilot("pilot contract not supported")'
        );
        // Try to set the pilot to the Rigs contract address
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(tokenId),
              rigs.address,
              BigNumber.from(1)
            )
        ).to.be.rejectedWith(
          'InvalidCustomPilot("pilot contract not supported")'
        );
      });

      it("Should not pilot Rig if untrained", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Deploy a faux ERC-721 token and mint to `tokenOwner`
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenIdRigOwner = event.args?.tokenId;
        // Attempt to pilot the Rig without starting training
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(tokenId),
              fauxERC721.address,
              pilotTokenIdRigOwner
            )
        ).to.be.rejectedWith("InvalidPilotStatus");
        // Train the Rig
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Attempt to pilot the Rig again, while in-flight but training incomplete
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(tokenId),
              fauxERC721.address,
              pilotTokenIdRigOwner
            )
        ).to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should allow ERC-721-compliant contract & owned pilot usage", async function () {
        // First, mint a Rig to `rigTokenOwner`
        await rigs.setMintPhase(3);
        const rigTokenOwner = accounts[4];
        let tx = await rigs
          .connect(rigTokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const rigTokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(rigTokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the Rig now that training has been completed
        await rigs
          .connect(rigTokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId));
        // Deploy a faux ERC-721 token but mint to an address *not* `rigTokenOwner`
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        const randomPilotTokenHolder = accounts[5];
        tx = await fauxERC721.connect(randomPilotTokenHolder).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenIdRandomPilotTokenHolder = event.args?.tokenId;
        // Try to use the faux ERC-721 token *not* owned by `rigTokenOwner`
        await expect(
          rigs
            .connect(rigTokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(rigTokenId),
              fauxERC721.address,
              pilotTokenIdRandomPilotTokenHolder
            )
        ).to.be.rejectedWith('InvalidCustomPilot("unauthorized")');
        // Mint a faux NFT and set the pilot to an ERC-721 contract & pilot
        tx = await fauxERC721.connect(rigTokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenIdRigOwner = event.args?.tokenId;
        await expect(
          await rigs
            .connect(rigTokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(rigTokenId),
              fauxERC721.address,
              pilotTokenIdRigOwner
            )
        )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            BigNumber.from(pilotTokenIdRigOwner)
          );
        // Try to pilot the Rig again, even though it's already in-flight
        await expect(
          rigs
            .connect(rigTokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(rigTokenId),
              fauxERC721.address,
              pilotTokenIdRigOwner
            )
        ).to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should pilot Rig if in-flight and has trainer pilot or trained and parked", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const rigTokenId = event.args?.tokenId;
        // Deploy a faux ERC721 token and mint a token to `tokenOwner`
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        let pilotTokenId = event.args?.tokenId;
        // Start to train the Rig
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId));
        // Save the block number, which will used when checking if a training Rig remains in-flight when piloted
        let blockNumber = tx.blockNumber;
        // Check the pilot info
        let pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId)
        );
        expect(pilotInfo.status).to.equal(1);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(blockNumber));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(1));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Pilot the Rig while in-flight since training is complete
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenId
          );
        await expect(tx)
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          );
        let pilotReceipt = await tx.wait();
        blockNumber = tx.blockNumber;
        // Check the pilot info
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId)
        );
        expect(pilotInfo.status).to.equal(3);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(blockNumber));
        expect(pilotInfo.addr).to.equal(fauxERC721.address);
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Park the Rig, now that training has completed
        await rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId));
        // Check the pilot info
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId)
        );
        expect(pilotInfo.status).to.equal(2);
        expect(pilotInfo.pilotable).to.equal(true);
        expect(pilotInfo.started).to.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(fauxERC721.address);
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Pilot the Rig with the same pilot, used before parking
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenId
          );
        await expect(tx)
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          );
        pilotReceipt = await tx.wait();
        blockNumber = pilotReceipt.blockNumber;
        // Check the pilot info
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId)
        );
        expect(pilotInfo.status).to.equal(3);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(blockNumber));
        expect(pilotInfo.addr).to.equal(fauxERC721.address);
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Park, then pilot with a new pilot from a new, different faux NFT contract
        await rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId));
        const fauxTwoERC721 = await (
          await FauxERC721Factory.deploy()
        ).deployed();
        tx = await fauxTwoERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        pilotTokenId = event.args?.tokenId;
        // Pilot with the new, unused "FauxTwo" pilot
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxTwoERC721.address,
            pilotTokenId
          );
        await expect(tx)
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId),
            fauxTwoERC721.address,
            BigNumber.from(pilotTokenId)
          );
        pilotReceipt = await tx.wait();
        blockNumber = pilotReceipt.blockNumber;
        // Check the pilot info
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId)
        );
        expect(pilotInfo.status).to.equal(3);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(blockNumber));
        expect(pilotInfo.addr).to.equal(fauxTwoERC721.address);
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
      });

      it("Should not set a trainer pilot if in-flight and already operated by trainer pilot", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Start to train the Rig
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Try to pilot the Rig with a trainer pilot while in-flight
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(tokenId),
              ethers.constants.AddressZero,
              2
            )
        ).to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should allow 0x0 contract for trainer pilot usage", async function () {
        // First, mint a Rig to `rigTokenOwner`
        await rigs.setMintPhase(3);
        const rigTokenOwner = accounts[4];
        const tx = await rigs
          .connect(rigTokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(rigTokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the Rig now that training has been completed
        await rigs
          .connect(rigTokenOwner)
          ["unstake(uint256)"](BigNumber.from(tokenId));
        // Set the pilot to a trainer
        await expect(
          await rigs.connect(rigTokenOwner)["stake(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            ethers.constants.AddressZero,
            BigNumber.from(2) // Pilot ID value doesn't matter
          )
        )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(tokenId),
            ethers.constants.AddressZero,
            BigNumber.from(2) // Pilot ID always `2` for trainer
          );
      });

      it("Should not allow the same custom pilot to operate multiple Rigs", async function () {
        // First, mint two Rigs to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const rigTokenId1 = event.args?.tokenId;
        tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const rigTokenId2 = event.args?.tokenId;
        // Train both Rigs, putting them in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId1));
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId2));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the Rigs now that training has been completed
        await rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId1));
        await rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId2));
        // Deploy a faux ERC721 token and mint a token to `tokenOwner`
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenId = event.args?.tokenId;
        // Set the pilot for the first Rig
        await rigs
          .connect(tokenOwner)
          ["stake(uint256,address,uint256)"](
            BigNumber.from(rigTokenId1),
            fauxERC721.address,
            pilotTokenId
          );
        // Try to set the same pilot for the second Rig; it should park the first Rig and pilot the second
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(rigTokenId2),
              fauxERC721.address,
              pilotTokenId
            )
        )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(rigTokenId1))
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId2),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          );
      });

      it("Should not batch pilot Rigs for empty, unequal length, or max length for arrays", async function () {
        // Try to send empty arrays
        await expect(
          rigs["stake(uint256[],address[],uint256[])"]([], [], [])
        ).to.be.rejectedWith("InvalidBatchPilotAction");
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            [BigNumber.from(0)],
            [],
            []
          )
        ).to.be.rejectedWith("InvalidBatchPilotAction");
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            [BigNumber.from(0)],
            [ethers.constants.AddressZero],
            []
          )
        ).to.be.rejectedWith("InvalidBatchPilotAction");
        // Try to send arrays of unequal lengths
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            [BigNumber.from(0), BigNumber.from(0)],
            [ethers.constants.AddressZero],
            [BigNumber.from(1)]
          )
        ).to.be.rejectedWith("InvalidBatchPilotAction");
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            [BigNumber.from(0)],
            [ethers.constants.AddressZero, ethers.constants.AddressZero],
            [BigNumber.from(1)]
          )
        ).to.be.rejectedWith("InvalidBatchPilotAction");
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            [BigNumber.from(0)],
            [ethers.constants.AddressZero],
            [BigNumber.from(1), BigNumber.from(2)]
          )
        ).to.be.rejectedWith("InvalidBatchPilotAction");
        // Try with an array of tokens exceeding 255 in length (the arbitrary limit)
        const tokenIds = [...Array(256).keys()];
        const pilotContracts = [...Array(256).keys()].map(
          (_) => ethers.constants.AddressZero
        );
        const pilotIds = [...Array(256).keys()];
        await expect(
          rigs["stake(uint256[],address[],uint256[])"](
            tokenIds,
            pilotContracts,
            pilotIds
          )
        ).to.be.rejectedWith("InvalidBatchPilotAction");
      });

      it("Should not allow batch piloting with the same pilot for different Rigs", async function () {
        // First, mint two Rigs to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const rigTokenId1 = event.args?.tokenId;
        tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const rigTokenId2 = event.args?.tokenId;
        // Train both Rigs, putting them in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId1));
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId2));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Deploy a faux ERC721 token and mint a token to `tokenOwner`
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenId = event.args?.tokenId;
        // Set the same pilot for both Rigs -- should pilot then park the first, and then pilot the second
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256[],address[],uint256[])"](
              [BigNumber.from(rigTokenId1), BigNumber.from(rigTokenId2)],
              [fauxERC721.address, fauxERC721.address],
              [pilotTokenId, pilotTokenId]
            )
        )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId1),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(rigTokenId1))
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId2),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          );
        // Check the pilot info for the first Rig -- it should be parked; it's latest pilot should still be accessible
        let pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId1)
        );
        expect(pilotInfo.status).to.equal(2); // `2` is equivalent to `PARKED` (`GarageStatus` enum's 3rd value)
        expect(pilotInfo.pilotable).to.equal(true);
        expect(pilotInfo.started).to.be.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(fauxERC721.address); // Faux pilot should still exist since no new pilot has been set again
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Check the pilot info for the second Rig
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId2)
        );
        expect(pilotInfo.status).to.equal(3); // `3` is equivalent to `PILOTED` (`GarageStatus` enum's 4th value)
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.not.be.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(fauxERC721.address);
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Park the second Rig that's in-flight
        rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId2));
        // Set the same pilot for both Rigs -- should pilot then park the first, and then pilot the second
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256[],address[],uint256[])"](
              [BigNumber.from(rigTokenId1), BigNumber.from(rigTokenId2)],
              [fauxERC721.address, fauxERC721.address],
              [pilotTokenId, pilotTokenId]
            )
        )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId1),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(rigTokenId1))
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId2),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          );
        // Check the pilot info for the first Rig -- it should be parked; it's latest pilot should still be accessible
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId1)
        );
        expect(pilotInfo.status).to.equal(2); // `2` is equivalent to `PARKED` (`GarageStatus` enum's 3rd value)
        expect(pilotInfo.pilotable).to.equal(true);
        expect(pilotInfo.started).to.be.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(fauxERC721.address); // Faux pilot should still exist since no new pilot has been set again
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Check the pilot info for the second Rig
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId2)
        );
        expect(pilotInfo.status).to.equal(3); // `3` is equivalent to `PILOTED` (`GarageStatus` enum's 4th value)
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.not.be.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(fauxERC721.address);
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
      });

      it("Should allow batch piloting with both custom and trainer pilots", async function () {
        // First, mint three Rigs to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const rigTokenId1 = event.args?.tokenId;
        tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const rigTokenId2 = event.args?.tokenId;
        tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const rigTokenId3 = event.args?.tokenId;
        // Train all Rigs, putting them in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId1));
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId2));
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId3));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the second and third Rigs that are in-flight
        rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId2));
        rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(rigTokenId3));
        // Deploy a faux ERC721 token and mint a token to `tokenOwner`
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenId = event.args?.tokenId;
        // Set a custom pilot for the first Rig, which is still in-flight, and
        // set a trainer pilot for the second/third Rigs (trained & parked)
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256[],address[],uint256[])"](
              [
                BigNumber.from(rigTokenId1),
                BigNumber.from(rigTokenId2),
                BigNumber.from(rigTokenId3),
              ],
              [
                fauxERC721.address,
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
              ],
              [pilotTokenId, 2, 2]
            )
        )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId1),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId2),
            ethers.constants.AddressZero, // Trainer contract is `0x0`
            BigNumber.from(2) // A trainer pilot is always `2`
          )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId3),
            ethers.constants.AddressZero,
            BigNumber.from(2)
          );
        // Check the pilot info for the first Rig
        let pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId1)
        );
        expect(pilotInfo.status).to.equal(3); // `3` is equivalent to `PILOTED` (`GarageStatus` enum's 4th value)
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.addr).to.equal(fauxERC721.address); // Faux pilot should still exist since no new pilot has been set again
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Check the pilot info for the second Rig
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId2)
        );
        expect(pilotInfo.status).to.equal(3); // `3` is equivalent to `PILOTED`
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(2));
        // Check the pilot info for the third Rig
        pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId3)
        );
        expect(pilotInfo.status).to.equal(3); // `3` is equivalent to `PILOTED`
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(2));
      });
    });

    describe("parkRig", function () {
      it("Should not park Rig when paused", async function () {
        await rigs.pause();

        // Try to park a single Rig when paused
        const sender = accounts[4];
        await expect(
          rigs.connect(sender)["unstake(uint256)"](BigNumber.from(0))
        ).to.be.revertedWith("Pausable: paused");
        // Try to park a multiple Rigs when paused
        await expect(
          rigs
            .connect(sender)
            ["unstake(uint256[])"]([BigNumber.from(0), BigNumber.from(0)])
        ).to.be.revertedWith("Pausable: paused");

        await rigs.unpause();
      });

      it("Should not park Rig for non-existent token", async function () {
        await expect(
          rigs["unstake(uint256)"](BigNumber.from(0))
        ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
      });

      it("Should not park Rig if msg.sender is not token owner or Rigs contract", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Attempt to park the Rig with an address that doesn't own the token
        const sender = accounts[5];
        await expect(
          rigs.connect(sender)["unstake(uint256)"](BigNumber.from(tokenId))
        ).to.be.rejectedWith("Unauthorized");
        // Attempt to park the Rig with an address that doesn't own the token
      });

      it("Should not park Rig if already parked", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Park the Rig before training has been completed
        await expect(
          rigs.connect(tokenOwner)["unstake(uint256)"](BigNumber.from(tokenId))
        ).to.emit(pilots, "Parked");
        // Try to park the Rig again
        await expect(
          rigs.connect(tokenOwner)["unstake(uint256)"](BigNumber.from(tokenId))
        ).to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should park Rig and reset training pilot data if training incomplete", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Check the Rig is in-flight, training
        // Recall that a state of `TRAINING` means that the contract is zero but pilot is set to `1`
        let pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(tokenId)
        );
        expect(pilotInfo.status).to.equal(1);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.not.be.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(1));
        // Park the Rig before training has been completed
        await expect(
          rigs.connect(tokenOwner)["unstake(uint256)"](BigNumber.from(tokenId))
        ).to.emit(pilots, "Parked");
        // Check that the index is now `0` since training was incomplete
        // Recall that a state of `UNTRAINED` means that the contract is zero and pilot is set to `0`
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(0);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(0));
        // Start training again but also park before training completed (advance 10 blocks)
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(10),
        ]);
        // Check the Rig is in-flight, training
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(1);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.not.be.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(1));
        // Park the Rig before training has been completed
        await expect(
          rigs.connect(tokenOwner)["unstake(uint256)"](BigNumber.from(tokenId))
        ).to.emit(pilots, "Parked");
        // Check that the pilot is now `0` since training was incomplete
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(0);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(0));
        // Start training again and advance 172800 blocks (30 days)
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Check that training complete (`pilotable` is `true`)
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(1);
        expect(pilotInfo.pilotable).to.equal(true);
        // Park the Rig now that training has been completed
        await expect(
          rigs.connect(tokenOwner)["unstake(uint256)"](BigNumber.from(tokenId))
        )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId));
        // Validate the pilot ID is `1` and it was not reset, now that training is complete
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(2);
        expect(pilotInfo.pilotable).to.equal(true);
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(1));
      });

      it("Should not allow a token transfer while not parked", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Try to transfer the Rig to `receiver`
        const receiver = accounts[5];
        await expect(
          rigs
            .connect(tokenOwner)
            .transferFrom(
              tokenOwner.address,
              receiver.address,
              BigNumber.from(tokenId)
            )
        ).to.be.rejectedWith("InvalidPilotStatus");
        // Park the Rig, and now successfully transfer
        await rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(tokenId));
        await expect(
          rigs
            .connect(tokenOwner)
            .transferFrom(
              tokenOwner.address,
              receiver.address,
              BigNumber.from(tokenId)
            )
        )
          .to.emit(rigs, "Transfer")
          .withArgs(
            tokenOwner.address,
            receiver.address,
            BigNumber.from(tokenId)
          );
        // Check out the pilot & owner info, post-transfer, just for fun
        const pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(tokenId)
        );
        expect(pilotInfo.status).to.equal(0);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(0));
        expect(await rigs.ownerOf(BigNumber.from(tokenId))).to.equal(
          receiver.address
        );
      });

      it("Should batch park Rigs", async function () {
        // First, mint 2 Rigs to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId1 = event.args?.tokenId;
        tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const tokenId2 = event.args?.tokenId;
        // Put the Rigs in-flight
        rigs
          .connect(tokenOwner)
          ["stake(uint256[])"]([
            BigNumber.from(tokenId1),
            BigNumber.from(tokenId2),
          ]);
        // Park both of the Rigs
        await expect(
          rigs
            .connect(tokenOwner)
            ["unstake(uint256[])"]([
              BigNumber.from(tokenId1),
              BigNumber.from(tokenId2),
            ])
        )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId1))
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId2));
      });

      it("Should not batch park a duplicate Rig token value", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Put the Rigs in-flight
        rigs.connect(tokenOwner)["stake(uint256[])"]([BigNumber.from(tokenId)]);
        // Park the Rig, but pass the same Rig `tokenId` twice -- the second parking attempt will fail
        await expect(
          rigs
            .connect(tokenOwner)
            ["unstake(uint256[])"]([
              BigNumber.from(tokenId),
              BigNumber.from(tokenId),
            ])
        )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId))
          .to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should not batch pilot Rig with empty array or exceeding max length for array", async function () {
        // Try with an empty array
        await expect(rigs["unstake(uint256[])"]([])).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
        // Try with an array of tokens exceeding 255 in length (the arbitrary limit)
        const tokenIds = [...Array(256).keys()];
        await expect(rigs["unstake(uint256[])"](tokenIds)).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
      });
    });

    describe("parkRigAsOwner", function () {
      it("Should not park Rig as owner for non-existent token", async function () {
        await expect(
          rigs.parkRigAsOwner([BigNumber.from(0)])
        ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
      });

      it("Should block contract non-owner", async function () {
        const _rigs = rigs.connect(accounts[2]);

        await expect(_rigs.parkRigAsOwner([1])).to.be.rejectedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Should allow contract owner to park any Rig", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Check pilot is untrained
        let pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(tokenId)
        );
        expect(pilotInfo.status).to.equal(0);
        // Start training
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Check pilot is training
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(1);
        // Park the Rig as the contract owner
        await expect(rigs.parkRigAsOwner([BigNumber.from(tokenId)]))
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId));
        // Check pilot is back to untrained
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(0);
        // Start training again
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the Rig as the contract owner
        await expect(rigs.parkRigAsOwner([BigNumber.from(tokenId)]))
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId));
      });

      it("Should allow training after being force parked during a training status", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the Rig as the contract owner
        await rigs.parkRigAsOwner([BigNumber.from(tokenId)]);
        // Check pilot is back to untrained
        const pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(tokenId)
        );
        // Check that the pilot is now `0` since it was force parked while training
        expect(pilotInfo.status).to.equal(0);
        expect(pilotInfo.pilotable).to.equal(false);
        expect(pilotInfo.started).to.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(ethers.constants.AddressZero);
        expect(pilotInfo.id).to.equal(BigNumber.from(0));
        // Train the Rig
        await expect(
          rigs.connect(tokenOwner)["stake(uint256)"](BigNumber.from(tokenId))
        )
          .to.emit(pilots, "Training")
          .withArgs(BigNumber.from(tokenId));
      });

      it("Should allow piloting after previously force parked during a training status", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const rigTokenId = event.args?.tokenId;
        // Train the Rig
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(rigTokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Deploy a faux ERC-721 token
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenId = event.args?.tokenId;
        // Pilot the Rig
        await rigs
          .connect(tokenOwner)
          ["stake(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenId
          );
        // Park the Rig as the contract owner
        await rigs.parkRigAsOwner([BigNumber.from(rigTokenId)]);
        // Check pilot is unchanged
        const pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(rigTokenId)
        );
        // Check that the Rig is pilotable & points to faux pilot while parked
        expect(pilotInfo.status).to.equal(2);
        expect(pilotInfo.pilotable).to.equal(true);
        expect(pilotInfo.started).to.equal(BigNumber.from(0));
        expect(pilotInfo.addr).to.equal(fauxERC721.address);
        expect(pilotInfo.id).to.equal(BigNumber.from(pilotTokenId));
        // Pilot the Rig
        await expect(
          await rigs
            .connect(tokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(rigTokenId),
              fauxERC721.address,
              pilotTokenId
            )
        )
          .to.emit(pilots, "Piloted")
          .withArgs(
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            BigNumber.from(pilotTokenId)
          );
      });

      it("Should not batch park a duplicate Rig token value", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Put the Rigs in-flight
        rigs.connect(tokenOwner)["stake(uint256[])"]([BigNumber.from(tokenId)]);
        // Park the Rig, but pass the same Rig `tokenId` twice -- the second parking attempt will fail
        await expect(
          rigs.parkRigAsOwner([
            BigNumber.from(tokenId),
            BigNumber.from(tokenId),
          ])
        )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId))
          .to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should not batch pilot Rig with empty array or exceeding max length for array", async function () {
        // Try with an empty array
        await expect(rigs.parkRigAsOwner([])).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
        // Try with an array of tokens exceeding 255 in length (the arbitrary limit)
        const tokenIds = [...Array(256).keys()];
        await expect(rigs.parkRigAsOwner(tokenIds)).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
      });
    });

    describe("parkRigAsAdmin", function () {
      it("Should not park Rig as admin for non-existent token", async function () {
        const admin = accounts[2];
        await rigs.setAdmin(admin.address);

        await expect(
          rigs.connect(admin).parkRigAsAdmin([BigNumber.from(0)])
        ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
      });

      it("Should block when caller is not admin", async function () {
        const admin = accounts[2];
        await rigs.setAdmin(admin.address);

        await expect(
          rigs.connect(accounts[3]).parkRigAsAdmin([1])
        ).to.be.rejectedWith("Caller is not the admin");
      });

      it("Should allow admin to park any Rig", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Check pilot is untrained
        let pilotInfo = await rigs["pilotInfo(uint256)"](
          BigNumber.from(tokenId)
        );
        expect(pilotInfo.status).to.equal(0);
        // Start training
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Check pilot is training
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(1);

        // Set admin
        const admin = accounts[5];
        await rigs.setAdmin(admin.address);

        // Park the Rig as the admin
        await expect(
          rigs.connect(admin).parkRigAsAdmin([BigNumber.from(tokenId)])
        )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId));
        // Check pilot is back to untrained
        pilotInfo = await rigs["pilotInfo(uint256)"](BigNumber.from(tokenId));
        expect(pilotInfo.status).to.equal(0);
      });

      it("Should not batch park a duplicate Rig token value", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;

        // Put the Rig in-flight
        rigs.connect(tokenOwner)["stake(uint256[])"]([BigNumber.from(tokenId)]);

        // Set admin
        const admin = accounts[5];
        await rigs.setAdmin(admin.address);

        // Park the Rig, but pass the same Rig `tokenId` twice -- the second parking attempt will fail
        await expect(
          rigs
            .connect(admin)
            .parkRigAsAdmin([BigNumber.from(tokenId), BigNumber.from(tokenId)])
        )
          .to.emit(pilots, "Parked")
          .withArgs(BigNumber.from(tokenId))
          .to.be.rejectedWith("InvalidPilotStatus");
      });

      it("Should not batch pilot Rig with empty array or exceeding max length for array", async function () {
        const admin = accounts[5];
        await rigs.setAdmin(admin.address);

        const _rigs = rigs.connect(admin);

        // Try with an empty array
        await expect(_rigs.parkRigAsAdmin([])).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
        // Try with an array of tokens exceeding 255 in length (the arbitrary limit)
        const tokenIds = [...Array(256).keys()];
        await expect(_rigs.parkRigAsAdmin(tokenIds)).to.be.rejectedWith(
          "InvalidBatchPilotAction"
        );
      });
    });

    describe("safeTransferWhileFlying", function () {
      it("Should block non-owner transfers", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Try to `safeTransferWhileFlying` by `sender`, who is not the owner
        const sender = accounts[5];
        await expect(
          rigs
            .connect(sender)
            .safeTransferWhileFlying(
              tokenOwner.address,
              sender.address,
              BigNumber.from(tokenId)
            )
        ).to.be.rejectedWith("Unauthorized");
        // As the `tokenOwner`, approve an `operator` to manage its tokens
        const operator = accounts[5];
        await rigs
          .connect(tokenOwner)
          .setApprovalForAll(operator.address, true);
        // Try to `safeTransferWhileFlying` by `operator`, who is not the owner
        await expect(
          rigs
            .connect(sender)
            .safeTransferWhileFlying(
              tokenOwner.address,
              operator.address,
              BigNumber.from(tokenId)
            )
        ).to.be.rejectedWith("Unauthorized");
      });

      it("Should allow transfers while flying, only by token owner", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        const tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        const receipt = await tx.wait();
        const [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig, putting it in-flight, and advance 1 block
        await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        // Successfully use`safeTransferWhileFlying` to transfer the Rig to `receiver`
        const receiver = accounts[5];
        await expect(
          rigs
            .connect(tokenOwner)
            .safeTransferWhileFlying(
              tokenOwner.address,
              receiver.address,
              BigNumber.from(tokenId)
            )
        )
          .to.emit(rigs, "Transfer")
          .withArgs(
            tokenOwner.address,
            receiver.address,
            BigNumber.from(tokenId)
          );
      });
    });

    describe("metadata refresh", function () {
      it("Should emit a metadata refresh event upon pilot status changes", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig & check `MetadataUpdate` was emitted
        await expect(
          rigs
            .connect(tokenOwner)
            ["stake(uint256)"](BigNumber.from(BigNumber.from(tokenId)))
        )
          .to.emit(rigs, "MetadataUpdate")
          .withArgs(BigNumber.from(tokenId));
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the Rig & check `MetadataUpdate` was emitted
        await expect(
          await rigs
            .connect(tokenOwner)
            ["unstake(uint256)"](BigNumber.from(tokenId))
        )
          .to.emit(rigs, "MetadataUpdate")
          .withArgs(BigNumber.from(tokenId));
        // Deploy a faux ERC-721 token
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenId = event.args?.tokenId;
        // Pilot the Rig & check `MetadataUpdate` was emitted
        await expect(
          await rigs
            .connect(tokenOwner)
            ["stake(uint256,address,uint256)"](
              BigNumber.from(tokenId),
              fauxERC721.address,
              pilotTokenId
            )
        )
          .to.emit(rigs, "MetadataUpdate")
          .withArgs(BigNumber.from(tokenId));
        // Park the Rig as contract owner & check `MetadataUpdate` was emitted
        await expect(await rigs.parkRigAsOwner([BigNumber.from(tokenId)]))
          .to.emit(rigs, "MetadataUpdate")
          .withArgs(BigNumber.from(tokenId));
      });
    });

    describe("token reputation", function () {
      it("Should emit a staking event upon training", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Start to train the Rig
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        receipt = await tx.wait();
        [, , event] = receipt.events ?? [];
        // Save the block number
        const blockNumber = tx.blockNumber;
        // Check that `Staked` was emitted
        expect(event.args?.tokenId).to.equal(BigNumber.from(tokenId));
        expect(event.args?.owner).to.equal(tokenOwner.address);
        expect(event.args?.block).to.equal(blockNumber);
      });

      it("Should emit an unstaking event upon parking", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Train the Rig & check `MetadataUpdate` was emitted
        // Start to train the Rig
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        receipt = await tx.wait();
        [, , event] = receipt.events ?? [];
        // Save the block number
        let blockNumber = tx.blockNumber;
        // Check `Staked` was emitted
        expect(event.args?.tokenId).to.equal(BigNumber.from(tokenId));
        expect(event.args?.owner).to.equal(tokenOwner.address);
        expect(event.args?.block).to.equal(blockNumber);
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Park the Rig & check `Unstaked` was emitted
        tx = await rigs
          .connect(tokenOwner)
          ["unstake(uint256)"](BigNumber.from(tokenId));
        receipt = await tx.wait();
        [, , event] = receipt.events ?? [];
        // Save the block number
        blockNumber = tx.blockNumber;
        // Check that `Unstaked` was emitted
        expect(event.args?.tokenId).to.equal(BigNumber.from(tokenId));
        expect(event.args?.owner).to.equal(tokenOwner.address);
        expect(event.args?.block).to.equal(blockNumber);
      });

      it("Should emit a staking event upon piloting", async function () {
        // First, mint a Rig to `tokenOwner`
        await rigs.setMintPhase(3);
        const tokenOwner = accounts[4];
        let tx = await rigs
          .connect(tokenOwner)
          ["mint(uint256)"](1, { value: getCost(1, 0.05) });
        let receipt = await tx.wait();
        let [event] = receipt.events ?? [];
        const tokenId = event.args?.tokenId;
        // Start to train the Rig
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256)"](BigNumber.from(tokenId));
        receipt = await tx.wait();
        // Advance 172800 blocks (30 days)
        await network.provider.send("hardhat_mine", [
          ethers.utils.hexValue(172800),
        ]);
        // Deploy a faux ERC-721 token
        const FauxERC721Factory = await ethers.getContractFactory(
          "TestERC721Enumerable"
        );
        const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
        tx = await fauxERC721.connect(tokenOwner).mint();
        receipt = await tx.wait();
        [event] = receipt.events ?? [];
        const pilotTokenId = event.args?.tokenId;
        // Pilot the Rig & check `Staked` was emitted
        tx = await rigs
          .connect(tokenOwner)
          ["stake(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            fauxERC721.address,
            pilotTokenId
          );
        receipt = await tx.wait();
        [, , , event] = receipt.events ?? [];
        console.log(receipt.events![3]);
        // Save the block number
        const blockNumber = tx.blockNumber;
        // Check that `Unstaked` was emitted
        expect(event.args?.tokenId).to.equal(BigNumber.from(tokenId));
        expect(event.args?.owner).to.equal(tokenOwner.address);
        expect(event.args?.block).to.equal(blockNumber);
      });
    });

    describe("delegation", function () {
      describe("stake", function () {
        it("Should train Rig if msg.sender is registered delegate for token.owner", async function () {
          // First, mint a Rig to `tokenOwner`
          await rigs.setMintPhase(3);
          const tokenOwner = accounts[4];
          const tx = await rigs
            .connect(tokenOwner)
            ["mint(uint256)"](1, { value: getCost(1, 0.05) });
          const receipt = await tx.wait();
          const [event] = receipt.events ?? [];
          const tokenId = event.args?.tokenId;

          const delegate = accounts[5];
          // Setup delegation
          await delegateCash.registerDelegate(
            delegate.address,
            tokenOwner.address,
            rigs.address,
            tokenId
          );

          // Train the Rig
          await expect(
            rigs.connect(delegate)["stake(uint256)"](BigNumber.from(tokenId))
          )
            .to.emit(pilots, "Training")
            .withArgs(BigNumber.from(tokenId));
        });
      });

      describe("pilotRig", function () {
        it("Should pilot rig if msg.sender is registered delegate for token.owner", async function () {
          // First, mint a Rig to `rigTokenOwner`
          await rigs.setMintPhase(3);
          const rigTokenOwner = accounts[4];
          let tx = await rigs
            .connect(rigTokenOwner)
            ["mint(uint256)"](1, { value: getCost(1, 0.05) });
          let receipt = await tx.wait();
          let [event] = receipt.events ?? [];
          const rigTokenId = event.args?.tokenId;
          // Train the Rig, putting it in-flight, and advance 1 block
          await rigs
            .connect(rigTokenOwner)
            ["stake(uint256)"](BigNumber.from(rigTokenId));
          // Advance 172800 blocks (30 days)
          await network.provider.send("hardhat_mine", [
            ethers.utils.hexValue(172800),
          ]);
          // Park the Rig now that training has been completed
          await rigs
            .connect(rigTokenOwner)
            ["unstake(uint256)"](BigNumber.from(rigTokenId));
          // Deploy a faux ERC-721 token but mint to an address *not* `rigTokenOwner`
          const FauxERC721Factory = await ethers.getContractFactory(
            "TestERC721Enumerable"
          );
          const fauxERC721 = await (
            await FauxERC721Factory.deploy()
          ).deployed();
          // Mint a faux NFT and set the pilot to an ERC-721 contract & pilot
          tx = await fauxERC721.connect(rigTokenOwner).mint();
          receipt = await tx.wait();
          [event] = receipt.events ?? [];
          const pilotTokenIdRigOwner = event.args?.tokenId;

          // Setup delegation
          const delegate = accounts[5];
          await delegateCash.registerDelegate(
            delegate.address,
            rigTokenOwner.address,
            rigs.address,
            rigTokenId
          );

          await expect(
            await rigs
              .connect(delegate)
              ["stake(uint256,address,uint256)"](
                BigNumber.from(rigTokenId),
                fauxERC721.address,
                pilotTokenIdRigOwner
              )
          )
            .to.emit(pilots, "Piloted")
            .withArgs(
              BigNumber.from(rigTokenId),
              fauxERC721.address,
              BigNumber.from(pilotTokenIdRigOwner)
            );
        });

        it("Should pilot with the trainer pilot rig if msg.sender is registered delegate for token.owner", async function () {
          // First, mint a Rig to `rigTokenOwner`
          await rigs.setMintPhase(3);
          const rigTokenOwner = accounts[4];
          const tx = await rigs
            .connect(rigTokenOwner)
            ["mint(uint256)"](1, { value: getCost(1, 0.05) });
          const receipt = await tx.wait();
          const [event] = receipt.events ?? [];
          const rigTokenId = event.args?.tokenId;
          // Train the Rig, putting it in-flight, and advance 1 block
          await rigs
            .connect(rigTokenOwner)
            ["stake(uint256)"](BigNumber.from(rigTokenId));
          // Advance 172800 blocks (30 days)
          await network.provider.send("hardhat_mine", [
            ethers.utils.hexValue(172800),
          ]);
          // Park the Rig now that training has been completed
          await rigs
            .connect(rigTokenOwner)
            ["unstake(uint256)"](BigNumber.from(rigTokenId));

          // Setup delegation
          const delegate = accounts[5];
          await delegateCash.registerDelegate(
            delegate.address,
            rigTokenOwner.address,
            rigs.address,
            rigTokenId
          );

          await expect(
            await rigs
              .connect(delegate)
              ["stake(uint256,address,uint256)"](
                BigNumber.from(rigTokenId),
                ethers.constants.AddressZero,
                BigNumber.from(1337)
              )
          )
            .to.emit(pilots, "Piloted")
            .withArgs(
              BigNumber.from(rigTokenId),
              ethers.constants.AddressZero,
              BigNumber.from(2) // Pilot ID always `2` for trainer
            );
        });
      });

      describe("parkRig", function () {
        it("Should park Rig if msg.sender is registered delegate for token.owner", async function () {
          // First, mint a Rig to `tokenOwner`
          await rigs.setMintPhase(3);
          const tokenOwner = accounts[4];
          const tx = await rigs
            .connect(tokenOwner)
            ["mint(uint256)"](1, { value: getCost(1, 0.05) });
          const receipt = await tx.wait();
          const [event] = receipt.events ?? [];
          const tokenId = event.args?.tokenId;

          // Train the Rig
          await expect(
            rigs.connect(tokenOwner)["stake(uint256)"](BigNumber.from(tokenId))
          )
            .to.emit(pilots, "Training")
            .withArgs(BigNumber.from(tokenId));

          // Setup delegation
          const delegate = accounts[5];
          await delegateCash.registerDelegate(
            delegate.address,
            tokenOwner.address,
            rigs.address,
            tokenId
          );

          await expect(
            rigs.connect(delegate)["unstake(uint256)"](BigNumber.from(tokenId))
          )
            .to.emit(pilots, "Parked")
            .withArgs(BigNumber.from(tokenId));
        });
      });
    });
  });
});
