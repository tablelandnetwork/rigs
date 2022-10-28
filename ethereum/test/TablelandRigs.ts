import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TablelandTables } from "@tableland/evm";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, utils } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { MerkleTree } from "merkletreejs";
import { AllowList, buildTree, hashEntry } from "../helpers/allowlist";
import { getURITemplate } from "../helpers/uris";
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
    // First, deploy the `TablelandTables` registry contract
    // Required for creating table from contract in `initPilots()`
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
    rigs = await (await RigsFactory.deploy()).deployed();
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

    // Create a `pilot_sessions` table, owned by contract
    const tx = await rigs.initPilots();
    const receipt = await tx.wait();
    const [event] = receipt.events ?? [];
    const pilotSessionsTableId = event.args?.tokenId;
    expect(await rigs.pilotSessionsTable()).to.be.equal(
      `pilot_sessions_${network.config.chainId}_${pilotSessionsTableId}`
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
      ).to.be.revertedWith("MintingClosed");

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
      ).to.be.revertedWith("MintingClosed");
    });

    it("Should not mint with zero quantity", async function () {
      await rigs.setMintPhase(3);
      const minter = accounts[10];
      await expect(rigs.connect(minter)["mint(uint256)"](0)).to.be.revertedWith(
        "ZeroQuantity"
      );
    });

    it("Should mint with allowlist during allowlist phase", async function () {
      await rigs.setMintPhase(1);

      // try public minting
      let minter = accounts[10];
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, { value: getCost(1, 0.05) })
      ).to.be.revertedWith("InvalidProof");

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
      ).to.be.revertedWith("InsufficientValue(50000000000000000)");

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
      ).to.be.revertedWith("InsufficientAllowance");

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
      ).to.be.revertedWith("InvalidProof");
    });

    it("Should mint with waitlist during waitlist phase", async function () {
      await rigs.setMintPhase(2);

      // try public minting
      let minter = accounts[10];
      await expect(
        rigs.connect(minter)["mint(uint256)"](1, { value: getCost(1, 0.05) })
      ).to.be.revertedWith("InvalidProof");

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
      ).to.be.revertedWith("InsufficientAllowance");

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
      ).to.be.revertedWith("InvalidProof");
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
      const tablelandHost = "http://testnet.tableland.network";
      const table1 = "table1";
      const table2 = "table2";
      const table3 = "table3";
      const uri = getURITemplate(tablelandHost, table1, table2, table3, false);
      const part0 =
        tablelandHost +
        "/query?extract=true&unwrap=true&s=" +
        encodeURIComponent(
          `select json_object('name','Rig #'||rig_id,'external_url','https://tableland.xyz/rigs/'||rig_id,'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name,'image_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,'image_medium','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name,'image_medium_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,'thumb','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name,'thumb_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,'animation_url',animation_base_url||rig_id||'.html','attributes',json_array(json_object('trait_type','status','value','pre-reveal'))) from table1 join table2 where rig_id=`
        );
      expect(uri[0]).to.equal(part0);
      const part1 = encodeURIComponent(" group by rig_id;");
      expect(uri[1]).to.equal(part1);
    });

    it("Should have final metadata if attributeTable", async function () {
      const tablelandHost = "http://testnet.tableland.network";
      const table1 = "table1";
      const table2 = "table2";
      const table3 = "table3";
      const uri = getURITemplate(tablelandHost, table1, table2, table3, true);
      const part0 =
        tablelandHost +
        "/query?extract=true&unwrap=true&s=" +
        encodeURIComponent(
          `select json_object('name','Rig #'||rig_id,'external_url','https://tableland.xyz/rigs/'||rig_id,'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name,'image_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,'image_medium','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name,'image_medium_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,'thumb','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name,'thumb_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,'animation_url',animation_base_url||rig_id||'.html','attributes',json_insert((select json_group_array(json_object('display_type',display_type,'trait_type',trait_type,'value',value))from table1 where rig_id=`
        );
      expect(uri[0]).to.equal(part0);
      const part1 = encodeURIComponent(
        " group by rig_id),'$[#]',json_object('display_type','string','trait_type','Garage Status','value',coalesce((select coalesce(end_time, 'in-flight') from table3 where rig_id="
      );
      expect(uri[1]).to.equal(part1);
      const part2 = encodeURIComponent(
        " and end_time is null),'parked')))) from table1 join table2 where rig_id="
      );
      expect(uri[2]).to.equal(part2);
      const part3 = encodeURIComponent(" group by rig_id;");
      expect(uri[3]).to.equal(part3);
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
    });
  });

  describe("The Garage", function () {
    it("Should not return pilot info for non-existent token", async function () {
      // Try calling with a non-existent token
      await expect(rigs.pilotInfo(BigNumber.from(0))).to.be.rejectedWith(
        "OwnerQueryForNonexistentToken"
      );
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
      const pilotInfo = await rigs.pilotInfo(BigNumber.from(tokenId));
      expect(pilotInfo.startTime).to.equal(BigNumber.from(0));
      expect(pilotInfo.pilot).to.equal(BigNumber.from(0));
      //   expect(await rigs.rigStatus(BigNumber.from(tokenId))).to.equal(0);
    });

    it("Should not return Rig status for non-existent token", async function () {
      // Try calling with a non-existent token
      await expect(rigs.pilotInfo(BigNumber.from(0))).to.be.rejectedWith(
        "OwnerQueryForNonexistentToken"
      );
    });

    it("Should not train Rig for non-existent token", async function () {
      await expect(rigs.trainRig(BigNumber.from(0))).to.be.rejectedWith(
        "OwnerQueryForNonexistentToken"
      );
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
        rigs.connect(sender).trainRig(BigNumber.from(tokenId))
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
      await expect(rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId)))
        .to.emit(rigs, "Training")
        .withArgs(BigNumber.from(1));
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
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
      // Try to train the Rig again
      await expect(
        rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId))
      ).to.be.rejectedWith("InvalidPilotStatus");
    });

    it("Should not pilot Rig for non-existent token", async function () {
      // Try with a single Rig and `pilotRig`
      await expect(
        rigs["pilotRig(uint256,address,uint256)"](
          BigNumber.from(0),
          ethers.constants.AddressZero,
          BigNumber.from(1)
        )
      ).to.be.rejectedWith("OwnerQueryForNonexistentToken");
      // Try with multiple Rigs and `pilotRig` (batch)
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"](
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
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            ethers.constants.AddressZero,
            BigNumber.from(1)
          )
      ).to.be.rejectedWith("Unauthorized");
    });

    it("Should not pilot Rig if untrained", async function () {
      // First, mint a Rig to `tokenOwner`
      await rigs.setMintPhase(3);
      const tokenOwner = accounts[4];
      const tx = await rigs
        .connect(tokenOwner)
        ["mint(uint256)"](1, { value: getCost(1, 0.05) });
      const receipt = await tx.wait();
      const [event] = receipt.events ?? [];
      const tokenId = event.args?.tokenId;
      // Attempt to pilot the Rig without starting training
      await expect(
        rigs
          .connect(tokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            ethers.constants.AddressZero,
            BigNumber.from(1)
          )
      ).to.be.rejectedWith("InvalidPilotStatus");
      // Train the Rig
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
      // Attempt to pilot the Rig again, while in-flight but training incomplete
      await expect(
        rigs
          .connect(tokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            ethers.constants.AddressZero,
            BigNumber.from(1)
          )
      ).to.be.rejectedWith("InvalidPilotStatus");
    });

    it("Should not batch pilot Rigs for empty, unequal length, or max length for arrays", async function () {
      // Try to send empty arrays
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"]([], [], [])
      ).to.be.rejectedWith("InvalidBatchPilotRig");
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"](
          [BigNumber.from(0)],
          [],
          []
        )
      ).to.be.rejectedWith("InvalidBatchPilotRig");
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"](
          [BigNumber.from(0)],
          [ethers.constants.AddressZero],
          []
        )
      ).to.be.rejectedWith("InvalidBatchPilotRig");
      // Try to send arrays of unequal lengths
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"](
          [BigNumber.from(0), BigNumber.from(0)],
          [ethers.constants.AddressZero],
          [BigNumber.from(1)]
        )
      ).to.be.rejectedWith("InvalidBatchPilotRig");
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"](
          [BigNumber.from(0)],
          [ethers.constants.AddressZero, ethers.constants.AddressZero],
          [BigNumber.from(1)]
        )
      ).to.be.rejectedWith("InvalidBatchPilotRig");
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"](
          [BigNumber.from(0)],
          [ethers.constants.AddressZero],
          [BigNumber.from(1), BigNumber.from(2)]
        )
      ).to.be.rejectedWith("InvalidBatchPilotRig");
      // Try with an array of tokens exceeding 255 in length (the arbitrary limit)
      const tokenIds = [...Array(256).keys()];
      const pilotContracts = [...Array(256).keys()].map(
        (_) => ethers.constants.AddressZero
      );
      const pilotIds = [...Array(256).keys()];
      await expect(
        rigs["pilotRig(uint256[],address[],uint256[])"](
          tokenIds,
          pilotContracts,
          pilotIds
        )
      ).to.be.rejectedWith("InvalidBatchPilotRig");
    });

    it("Should not park Rig for non-existent token", async function () {
      await expect(rigs.parkRig(BigNumber.from(0))).to.be.rejectedWith(
        "OwnerQueryForNonexistentToken"
      );
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
        rigs.connect(sender).parkRig(BigNumber.from(tokenId))
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
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
      // Park the Rig before training has been completed
      await expect(
        rigs.connect(tokenOwner).parkRig(BigNumber.from(tokenId))
      ).to.emit(rigs, "Parked");
      // Try to park the Rig again
      await expect(
        rigs.connect(tokenOwner).parkRig(BigNumber.from(tokenId))
      ).to.be.rejectedWith("InvalidPilotStatus");
    });

    it("Should park Rig and reset pilot 'index' if training incomplete", async function () {
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
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
      // Check the Rig is in-flight, training
      let pilotInfo = await rigs.pilotInfo(BigNumber.from(tokenId));
      expect(pilotInfo.pilot).to.equal(BigNumber.from(1));
      expect(pilotInfo.startTime).to.not.be.equal(BigNumber.from(0));
      // Park the Rig before training has been completed
      await expect(
        rigs.connect(tokenOwner).parkRig(BigNumber.from(tokenId))
      ).to.emit(rigs, "Parked");
      // Check that the index is now `0` since training was incomplete
      pilotInfo = await rigs.pilotInfo(BigNumber.from(tokenId));
      expect(pilotInfo.pilot).to.equal(BigNumber.from(0));
      expect(pilotInfo.startTime).to.equal(BigNumber.from(0));
      // Start training again but also park before training completed (advance 10 blocks)
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
      await network.provider.send("hardhat_mine", [ethers.utils.hexValue(10)]);
      // Check the Rig is in-flight, training
      pilotInfo = await rigs.pilotInfo(BigNumber.from(tokenId));
      expect(pilotInfo.pilot).to.equal(BigNumber.from(1));
      expect(pilotInfo.startTime).to.not.be.equal(BigNumber.from(0));
      // Park the Rig before training has been completed
      await expect(
        rigs.connect(tokenOwner).parkRig(BigNumber.from(tokenId))
      ).to.emit(rigs, "Parked");
      // Check that the index is now `0` since training was incomplete
      pilotInfo = await rigs.pilotInfo(BigNumber.from(tokenId));
      expect(pilotInfo.pilot).to.equal(BigNumber.from(0));
      expect(pilotInfo.startTime).to.equal(BigNumber.from(0));
      // Start training again and advance 172800 blocks (30 days)
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
      await network.provider.send("hardhat_mine", [
        ethers.utils.hexValue(172800),
      ]);
      // Park the Rig now that training has been completed
      await expect(rigs.connect(tokenOwner).parkRig(BigNumber.from(tokenId)))
        .to.emit(rigs, "Parked")
        .withArgs(BigNumber.from(tokenId));
      // Validate the pilot `index` is `1` and it was not reset, now that training is complete
      pilotInfo = await rigs.pilotInfo(BigNumber.from(tokenId));
      expect(pilotInfo.pilot).to.equal(BigNumber.from(1));
    });

    it("Should not allow non-ERC-721 or Rigs contract for pilots", async function () {
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
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
      // Advance 172800 blocks (30 days)
      await network.provider.send("hardhat_mine", [
        ethers.utils.hexValue(172800),
      ]);
      // Park the Rig, now that training has completed
      await rigs.connect(tokenOwner).parkRig(BigNumber.from(tokenId));
      // Try to set the pilot to a non-ERC721 address
      await expect(
        rigs
          .connect(tokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            ethers.constants.AddressZero,
            BigNumber.from(1)
          )
      ).to.be.rejectedWith("InvalidCustomPilot");
      // Try to set the pilot to the Rigs contract address
      await expect(
        rigs
          .connect(tokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(tokenId),
            rigs.address,
            BigNumber.from(1)
          )
      ).to.be.rejectedWith("InvalidCustomPilot");
    });

    it("Should allow ERC-721-compliant contract & owned pilot usage", async function () {
      // First, mint a Rig to `tokenOwner`
      await rigs.setMintPhase(3);
      const rigTokenOwner = accounts[4];
      let tx = await rigs
        .connect(rigTokenOwner)
        ["mint(uint256)"](1, { value: getCost(1, 0.05) });
      let receipt = await tx.wait();
      let [event] = receipt.events ?? [];
      const rigTokenId = event.args?.tokenId;
      // Train the Rig, putting it in-flight, and advance 1 block
      await rigs.connect(rigTokenOwner).trainRig(BigNumber.from(rigTokenId));
      // Advance 172800 blocks (30 days)
      await network.provider.send("hardhat_mine", [
        ethers.utils.hexValue(172800),
      ]);
      // Park the Rig now that training has been completed
      await rigs.connect(rigTokenOwner).parkRig(BigNumber.from(rigTokenId));
      // Deploy a faux ERC-721 token but mint to an address *not* `tokenOwner`
      const FauxERC721Factory = await ethers.getContractFactory(
        "TestERC721Enumerable"
      );
      const fauxERC721 = await (await FauxERC721Factory.deploy()).deployed();
      const randomPilotTokenHolder = accounts[5];
      tx = await fauxERC721.connect(randomPilotTokenHolder).mint();
      receipt = await tx.wait();
      [event] = receipt.events ?? [];
      const pilotTokenIdRandomPilotTokenHolder = event.args?.tokenId;
      // Try to set the pilot to the Rigs contract address
      await expect(
        rigs
          .connect(rigTokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenIdRandomPilotTokenHolder
          )
      ).to.be.rejectedWith("InvalidCustomPilot");
      // Mint a faux NFT and set the pilot to an ERC-721 contract & pilot
      tx = await fauxERC721.connect(rigTokenOwner).mint();
      receipt = await tx.wait();
      [event] = receipt.events ?? [];
      const pilotTokenIdRigOwner = event.args?.tokenId;
      await expect(
        await rigs
          .connect(rigTokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenIdRigOwner
          )
      )
        .to.emit(rigs, "Piloted")
        .withArgs(BigNumber.from(rigTokenId));
      // Try to pilot the Rig again, even though it's already in-flight
      await expect(
        rigs
          .connect(rigTokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenIdRigOwner
          )
      ).to.be.rejectedWith("InvalidPilotStatus");
    });

    it("Should pilot Rig if in-flight with trainer pilot or trained plus parked", async function () {
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
      const pilotTokenId = event.args?.tokenId;
      // Train the Rig and advance 172800 blocks (30 days)
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(rigTokenId));
      await network.provider.send("hardhat_mine", [
        ethers.utils.hexValue(172800),
      ]);
      // Pilot the Rig while in-flight and training complete (i.e., trainer pilot)
      await expect(
        rigs
          .connect(tokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenId
          )
      )
        .to.emit(rigs, "Piloted")
        .withArgs(BigNumber.from(rigTokenId));
      // Park the Rig, now that training has completed
      await rigs.connect(tokenOwner).parkRig(BigNumber.from(rigTokenId));
      // Pilot the Rig with the same pilot, used before parking
      await expect(
        rigs
          .connect(tokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(rigTokenId),
            fauxERC721.address,
            pilotTokenId
          )
      )
        .to.emit(rigs, "Piloted")
        .withArgs(BigNumber.from(rigTokenId));
    });

    it("Should not allow the same pilot to operate multiple Rigs", async function () {
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
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(rigTokenId1));
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(rigTokenId2));
      // Advance 172800 blocks (30 days)
      await network.provider.send("hardhat_mine", [
        ethers.utils.hexValue(172800),
      ]);
      // Park the Rigs now that training has been completed
      await rigs.connect(tokenOwner).parkRig(BigNumber.from(rigTokenId1));
      await rigs.connect(tokenOwner).parkRig(BigNumber.from(rigTokenId2));
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
        ["pilotRig(uint256,address,uint256)"](
          BigNumber.from(rigTokenId1),
          fauxERC721.address,
          pilotTokenId
        );
      // Try to set the same pilot for the second Rig; it should park the first Rig and pilot the second
      await expect(
        rigs
          .connect(tokenOwner)
          ["pilotRig(uint256,address,uint256)"](
            BigNumber.from(rigTokenId2),
            fauxERC721.address,
            pilotTokenId
          )
      )
        .to.emit(rigs, "Parked")
        .withArgs(BigNumber.from(rigTokenId1))
        .to.emit(rigs, "Piloted")
        .withArgs(BigNumber.from(rigTokenId2));
    });

    it("Should not allow a token transfer while not parked", async function () {
      // First, mint two Rigs to `tokenOwner`
      await rigs.setMintPhase(3);
      const tokenOwner = accounts[4];
      const tx = await rigs
        .connect(tokenOwner)
        ["mint(uint256)"](1, { value: getCost(1, 0.05) });
      const receipt = await tx.wait();
      const [event] = receipt.events ?? [];
      const tokenId = event.args?.tokenId;
      // Train both Rigs, putting them in-flight, and advance 1 block
      await rigs.connect(tokenOwner).trainRig(BigNumber.from(tokenId));
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
      // Finish training the Rig and try again
      await network.provider.send("hardhat_mine", [
        ethers.utils.hexValue(172800),
      ]);
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
      await rigs.connect(tokenOwner).parkRig(BigNumber.from(tokenId));
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
      const pilotInfo = await rigs.pilotInfo(BigNumber.from(tokenId));
      expect(pilotInfo.startTime).to.equal(BigNumber.from(0));
      expect(pilotInfo.pilot).to.equal(BigNumber.from(1));
      expect(await rigs.ownerOf(BigNumber.from(tokenId))).to.equal(
        receiver.address
      );
    });
  });
});
