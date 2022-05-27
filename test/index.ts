import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TablelandRigs } from "../typechain-types/index";

chai.use(chaiAsPromised);
const expect = chai.expect;

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
    expect("0x0000000000000000000000000000000000000000").to.equal(
      event.args?.from
    );
    expect(minter.address).to.equal(event.args?.to);
    expect(BigNumber.from(1)).to.equal(event.args?.tokenId);

    // check new balance
    const balance = await rigs.balanceOf(minter.address);
    expect(BigNumber.from(1)).to.equal(balance);

    // check owned tokens
    const tokens = await rigs.tokensOfOwner(minter.address);
    expect(1).to.equal(tokens.length);
    expect(BigNumber.from(1)).to.equal(tokens[0]);

    // check total supply
    const totalSupply = await rigs.totalSupply();
    expect(BigNumber.from(1)).to.equal(totalSupply);
  });

  it("Should mint multiple rigs", async function () {
    const minter = accounts[5];
    const tx = await rigs.connect(minter).mint(3);
    const receipt = await tx.wait();
    const [event] = receipt.events ?? [];

    // check transfer event
    expect("0x0000000000000000000000000000000000000000").to.equal(
      event.args?.from
    );
    expect(minter.address).to.equal(event.args?.to);
    expect(BigNumber.from(1)).to.equal(event.args?.tokenId);

    // check new balance
    const balance = await rigs.balanceOf(minter.address);
    expect(BigNumber.from(3)).to.equal(balance);

    // check owned tokens
    const tokens = await rigs.tokensOfOwner(minter.address);
    expect(3).to.equal(tokens.length);
    expect(BigNumber.from(1)).to.equal(tokens[0]);

    // check total supply
    const totalSupply = await rigs.totalSupply();
    expect(BigNumber.from(3)).to.equal(totalSupply);
  });

  it("Should udpate the base URI", async function () {
    let tx = await rigs.setBaseURI("https://fake.com/");
    await tx.wait();

    const minter = accounts[6];
    tx = await rigs.connect(minter).mint(1);
    const receipt = await tx.wait();
    const [event] = receipt.events ?? [];

    const uri = await rigs.tokenURI(event.args?.tokenId);
    expect("https://fake.com/1").to.equal(uri);
  });

  it("Should pause and unpause minting", async function () {
    const minter = accounts[7];
    let tx = await rigs.connect(minter).mint(1);
    await tx.wait();

    tx = await rigs.pause();
    await tx.wait();

    tx = await rigs.connect(minter).mint(1);
    await expect(tx.wait()).to.be.rejectedWith(Error);

    tx = await rigs.unpause();
    await tx.wait();

    tx = await rigs.connect(minter).mint(1);
    await tx.wait();
  });
});
