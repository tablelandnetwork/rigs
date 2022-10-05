import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import { PaymentSplitter, SQLHelpers, TablelandRigs } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import { AllowList, buildTree, hashEntry } from "../helpers/allowlist";
import { getURITemplate } from "../helpers/uris";

chai.use(chaiAsPromised);
const expect = chai.expect;
const assert = chai.assert;

function getCost(quantity: number, price: number): BigNumber {
  return utils.parseEther((quantity * price).toFixed(2));
}

describe("Rigs", function () {
  let rigs: TablelandRigs;
  let splitter: PaymentSplitter;
  let accounts: SignerWithAddress[];
  let beneficiary: SignerWithAddress;
  const allowlist: AllowList = {};
  const waitlist: AllowList = {};
  let allowlistTree: MerkleTree;
  let waitlistTree: MerkleTree;
  let sqlHelpers: SQLHelpers;

  beforeEach(async function () {
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

    const SplitterFactory = await ethers.getContractFactory("PaymentSplitter");
    splitter = (await SplitterFactory.deploy(
      [accounts[2].address, accounts[3].address],
      [20, 80]
    )) as PaymentSplitter;
    await splitter.deployed();

    const SQLHelpersFactory = await ethers.getContractFactory("SQLHelpers");
    sqlHelpers = (await SQLHelpersFactory.deploy()) as SQLHelpers;
    await sqlHelpers.deployed();

    const RigsFactory = await ethers.getContractFactory("TablelandRigs", {
      libraries: {
        SQLHelpers: sqlHelpers.address,
      },
    });
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
  });

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
      .withArgs(minter.address, getCost(quantity - entry.paidAllowance, 0.05));

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
    const uri = getURITemplate(tablelandHost, table1, table2, false);
    const result =
      tablelandHost +
      "/query?extract=true&unwrap=true&s=" +
      encodeURIComponent(
        `select json_object('name','Rig #'||rig_id,'external_url','https://tableland.xyz/rigs/'||rig_id,'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name,'image_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,'image_medium','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name,'image_medium_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,'thumb','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name,'thumb_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,'animation_url',animation_base_url||rig_id,'attributes',json_array(json_object('trait_type','status','value','pre-reveal'))) from table1 join table2 where rig_id=`
      );
    expect(uri[0]).to.equal(result);
    expect(uri[1]).to.equal("%20group%20by%20rig_id%3B");
  });

  it("Should have final metadata if attributeTable", async function () {
    const tablelandHost = "http://testnet.tableland.network";
    const table1 = "table1";
    const table2 = "table2";
    const uri = getURITemplate(tablelandHost, table1, table2, true);
    const result =
      tablelandHost +
      "/query?extract=true&unwrap=true&s=" +
      encodeURIComponent(
        `select json_object('name','Rig #'||rig_id,'external_url','https://tableland.xyz/rigs/'||rig_id,'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name,'image_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,'image_medium','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name,'image_medium_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,'thumb','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name,'thumb_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,'animation_url',animation_base_url||rig_id,'attributes',json_group_array(json_object('display_type',display_type,'trait_type',trait_type,'value',value))) from table1 join table2 where rig_id=`
      );

    expect(uri[0]).to.equal(result);
    expect(uri[1]).to.equal("%20group%20by%20rig_id%3B");
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

    await expect(_rigs.setBeneficiary(accounts[2].address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

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
