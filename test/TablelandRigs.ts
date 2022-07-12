import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import { PaymentSplitter, TablelandRigs } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import { AllowList, buildTree, hashEntry } from "../helpers/allowlist";

chai.use(chaiAsPromised);
const expect = chai.expect;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("Rigs", function () {
  let rigs: TablelandRigs;
  let splitter: PaymentSplitter;
  let accounts: SignerWithAddress[];
  let beneficiary: SignerWithAddress;
  const allowlist: AllowList = {};
  let merkletree: MerkleTree;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    beneficiary = accounts[1];

    accounts.slice(0, 5).forEach((a: SignerWithAddress, i: number) => {
      allowlist[a.address] = i;
    });
    merkletree = buildTree(allowlist);

    const SplitterFactory = await ethers.getContractFactory("PaymentSplitter");
    splitter = (await SplitterFactory.deploy(
      [accounts[2].address, accounts[3].address],
      [20, 80]
    )) as PaymentSplitter;
    await splitter.deployed();

    const RigsFactory = await ethers.getContractFactory("TablelandRigs");
    rigs = await RigsFactory.deploy(
      BigNumber.from(3000),
      utils.parseEther("0.05"),
      beneficiary.address,
      splitter.address,
      merkletree.getHexRoot()
    );
    await rigs.deployed();

    const tx = await rigs.setURITemplate("https://foo.xyz/{id}/bar");
    await tx.wait();
  });

  it("Should mint a single rig", async function () {
    const minter = accounts[4];
    const tx = await rigs
      .connect(minter)
      .mint(1, { value: utils.parseEther("0.06") });
    const receipt = await tx.wait();
    const [event] = receipt.events ?? [];

    // check transfer event
    expect(event.args?.from).to.equal(ZERO_ADDRESS);
    expect(event.args?.to).to.equal(minter.address);
    expect(event.args?.tokenId).to.equal(BigNumber.from(1));

    // check new balance
    const balance = await rigs.balanceOf(minter.address);
    expect(balance).to.equal(BigNumber.from(1));

    // check owned tokens
    const tokens = await rigs.tokensOfOwner(minter.address);
    expect(tokens.length).to.equal(1);
    expect(tokens[0]).to.equal(BigNumber.from(1));

    // check total supply
    const totalSupply = await rigs.totalSupply();
    expect(totalSupply).to.equal(BigNumber.from(1));
  });

  it("Should mint multiple rigs", async function () {
    const minter = accounts[5];
    const tx = await rigs.connect(minter).mint(3);
    const receipt = await tx.wait();
    const [event] = receipt.events ?? [];

    // check transfer event
    expect(event.args?.from).to.equal(ZERO_ADDRESS);
    expect(event.args?.to).to.equal(minter.address);
    expect(event.args?.tokenId).to.equal(BigNumber.from(1));

    // check new balance
    const balance = await rigs.balanceOf(minter.address);
    expect(balance).to.equal(BigNumber.from(3));

    // check owned tokens
    const tokens = await rigs.tokensOfOwner(minter.address);
    expect(tokens.length).to.equal(3);
    expect(tokens[0]).to.equal(BigNumber.from(1));

    // check total supply
    const totalSupply = await rigs.totalSupply();
    expect(totalSupply).to.equal(BigNumber.from(3));
  });

  it("Should udpate the URI template", async function () {
    let tx = await rigs.setURITemplate("https://fake.com/");
    await tx.wait();

    const minter = accounts[6];
    tx = await rigs.connect(minter).mint(1);
    const receipt = await tx.wait();
    const [event] = receipt.events ?? [];

    const uri = await rigs.tokenURI(event.args?.tokenId);
    expect(uri).to.equal("https://fake.com/1");
  });

  it("Should pause and unpause minting", async function () {
    const minter = accounts[7];
    let tx = await rigs.connect(minter).mint(1);
    await tx.wait();

    tx = await rigs.pause();
    await tx.wait();

    await expect(rigs.connect(minter).mint(1)).to.be.revertedWith(
      "Pausable: paused"
    );

    tx = await rigs.unpause();
    await tx.wait();

    tx = await rigs.connect(minter).mint(1);
    await tx.wait();
  });

  it("Should return token URI for a token", async function () {
    const minter = accounts[7];
    const tx = await rigs
      .connect(minter)
      .mint(1, { value: utils.parseEther("0.06") });
    const receipt = await tx.wait();
    const [event] = receipt.events ?? [];
    const tokenId = event.args?.tokenId;

    const uri = await rigs.tokenURI(tokenId);

    console.log(uri);
  });

  it.only("Should only allow allowed accounts to claim", async function () {
    let tx = await rigs.openClaims();
    await tx.wait();

    const claimer = accounts[1];
    const proof = merkletree.getHexProof(
      hashEntry(claimer.address, allowlist[claimer.address])
    );
    tx = await rigs
      .connect(accounts[1])
      .claim(1, 1, proof, { value: utils.parseEther("0.05") });
    await tx.wait();
    // console.log(receipt.events);

    // await expect(this.registry.redeem(account, tokenId, proof))
    //   .to.emit(this.registry, 'Transfer')
    //   .withArgs(ethers.constants.AddressZero, account, tokenId);
  });
});
