import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TablelandRigs } from "../typechain-types/index";

chai.use(chaiAsPromised);
const expect = chai.expect;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("Rigs", function () {
  let rigs: TablelandRigs;
  let accounts: SignerWithAddress[];

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TablelandRigs");
    rigs = await Factory.deploy("https://website.com/");
    await rigs.deployed();
  });

  it("Should mint a single rig", async function () {
    const minter = accounts[4];
    const tx = await rigs.connect(minter).mint(1);
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

  it("Should udpate the base URI", async function () {
    let tx = await rigs.setBaseURI("https://fake.com/");
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
});
