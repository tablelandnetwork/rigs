import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, utils } from "ethers";
import { artifacts, ethers, network, upgrades } from "hardhat";
import { buildTree } from "../../helpers/allowlist";
import type {
  TablelandRigs,
  TablelandRigsLegacy,
  TablelandRigPilots,
} from "../../typechain-types";

chai.use(chaiAsPromised);
const expect = chai.expect;

// Addresses that the legacy contracts call into
const LOCAL_TABLELAND_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const DELEGATE_CASH_ADDRESS = "0x00000000000076a84fef008cdabe6409d2fe638b";

async function setCodeFrom(contractName: string, target: string) {
  const { deployedBytecode } = await artifacts.readArtifact(contractName);
  await network.provider.send("hardhat_setCode", [target, deployedBytecode]);
}

// The registry address used by `TablelandDeployments` on the Hardhat network.
// It is also the address of the deployer's second deployment, so install a
// stand-in registry there and move the deployer past that nonce.
async function useLocalTablelandMock(deployer: SignerWithAddress) {
  await setCodeFrom("TablelandTablesMock", LOCAL_TABLELAND_ADDRESS);
  if ((await deployer.getTransactionCount()) < 2) {
    await network.provider.send("hardhat_setNonce", [deployer.address, "0x2"]);
  }
}

describe("TablelandRigsUpgrade", function () {
  let accounts: SignerWithAddress[];
  let snapshot: string;

  before(async function () {
    snapshot = await network.provider.send("evm_snapshot");
    accounts = await ethers.getSigners();
    await useLocalTablelandMock(accounts[0]);
    await setCodeFrom("DelegateCashMock", DELEGATE_CASH_ADDRESS);
  });

  after(async function () {
    await network.provider.send("evm_revert", [snapshot]);
  });

  it("Should unlock in-flight Rigs and keep state after upgrading from the pilots implementation", async function () {
    const [owner, beneficiary, splitter, tokenOwner, operator, buyer, admin] =
      accounts;
    const tree = buildTree({
      [tokenOwner.address]: { freeAllowance: 1, paidAllowance: 1 },
    });

    // Deploy the legacy (pilots) implementation behind a proxy
    const LegacyFactory = await ethers.getContractFactory(
      "TablelandRigsLegacy"
    );
    const legacy = (await (
      await upgrades.deployProxy(
        LegacyFactory,
        [
          BigNumber.from(3000),
          utils.parseEther("0.05"),
          beneficiary.address,
          splitter.address,
          tree.getHexRoot(),
          tree.getHexRoot(),
        ],
        { kind: "uups" }
      )
    ).deployed()) as TablelandRigsLegacy;
    const PilotsFactory = await ethers.getContractFactory("TablelandRigPilots");
    const pilots = (await (
      await upgrades.deployProxy(PilotsFactory, [legacy.address], {
        kind: "uups",
      })
    ).deployed()) as TablelandRigPilots;
    await (await legacy.initPilots(pilots.address)).wait();
    await (await legacy.setAdmin(admin.address)).wait();
    await (
      await legacy.setURITemplate(["https://example.com/metadata/", ".json"])
    ).wait();
    await (
      await legacy.setContractURI("https://example.com/contract.json")
    ).wait();

    // Mint three Rigs
    await (await legacy.setMintPhase(3)).wait();
    await (
      await legacy
        .connect(tokenOwner)
        ["mint(uint256)"](3, { value: utils.parseEther("0.15") })
    ).wait();

    // Rig 1: training; Rig 2: trained and piloted with a trainer; Rig 3: untrained
    await (await legacy.connect(tokenOwner)["trainRig(uint256)"](2)).wait();
    await network.provider.send("hardhat_mine", [utils.hexValue(172800)]);
    await (await legacy.connect(tokenOwner)["parkRig(uint256)"](2)).wait();
    await (
      await legacy
        .connect(tokenOwner)
        ["pilotRig(uint256,address,uint256)"](
          2,
          ethers.constants.AddressZero,
          0
        )
    ).wait();
    await (await legacy.connect(tokenOwner)["trainRig(uint256)"](1)).wait();
    expect((await legacy["pilotInfo(uint256)"](1)).status).to.equal(1); // TRAINING
    expect((await legacy["pilotInfo(uint256)"](2)).status).to.equal(3); // PILOTED

    // The legacy implementation blocks operator transfers of in-flight Rigs
    await (
      await legacy.connect(tokenOwner).setApprovalForAll(operator.address, true)
    ).wait();
    await expect(
      legacy
        .connect(operator)
        .transferFrom(tokenOwner.address, buyer.address, 1)
    ).to.be.rejectedWith("InvalidPilotStatus");

    // Upgrade to the current implementation
    const Factory = await ethers.getContractFactory("TablelandRigs");
    const rigs = (await (
      await upgrades.upgradeProxy(legacy.address, Factory, { kind: "uups" })
    ).deployed()) as TablelandRigs;
    expect(rigs.address).to.equal(legacy.address);

    // State is preserved
    expect(await rigs.owner()).to.equal(owner.address);
    expect(await rigs.maxSupply()).to.equal(3000);
    expect(await rigs.mintPrice()).to.equal(utils.parseEther("0.05"));
    expect(await rigs.beneficiary()).to.equal(beneficiary.address);
    expect(await rigs.allowlistRoot()).to.equal(tree.getHexRoot());
    expect(await rigs.mintPhase()).to.equal(3);
    expect(await rigs.totalSupply()).to.equal(3);
    expect(await rigs.tokenURI(2)).to.equal(
      "https://example.com/metadata/2.json"
    );
    expect(await rigs.contractURI()).to.equal(
      "https://example.com/contract.json"
    );
    const [receiver, amount] = await rigs.royaltyInfo(1, 10000);
    expect(receiver).to.equal(splitter.address);
    expect(amount).to.equal(500);
    for (const id of [1, 2, 3]) {
      expect(await rigs.ownerOf(id)).to.equal(tokenOwner.address);
    }

    // Rigs that were in flight can now be transferred by an operator
    for (const id of [1, 2, 3]) {
      await expect(
        rigs
          .connect(operator)
          .transferFrom(tokenOwner.address, buyer.address, id)
      )
        .to.emit(rigs, "Transfer")
        .withArgs(tokenOwner.address, buyer.address, id);
    }

    // Pilot methods are gone, even though the Pilots contract still has state
    expect(await pilots.pilotStartTime(1)).to.not.equal(0);
    await expect(
      buyer.sendTransaction({
        to: rigs.address,
        data: legacy.interface.encodeFunctionData("trainRig(uint256)", [3]),
      })
    ).to.be.reverted;
    await expect(
      owner.sendTransaction({
        to: rigs.address,
        data: legacy.interface.encodeFunctionData("parkRigAsOwner", [[1]]),
      })
    ).to.be.reverted;

    // One call refreshes metadata for every Rig
    await expect(rigs.refreshMetadata())
      .to.emit(rigs, "BatchMetadataUpdate")
      .withArgs(1, 3);
  });
});
