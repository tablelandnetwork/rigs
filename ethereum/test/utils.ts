import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { TestSQLHelpers, TablelandTables } from "@tableland/evm";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

// Deploy `TablelandTables` contract *once*, which is used by a fixture
// Required for `TablelandDeployments.sol` calls to work with `TablelandTables`
export async function deployTablelandTables() {
  const TablelandTablesFactory = await ethers.getContractFactory(
    "TablelandTables"
  );
  return await (
    (await upgrades.deployProxy(TablelandTablesFactory, ["https://foo.xyz/"], {
      kind: "uups",
    })) as TablelandTables
  ).deployed();
}

// Create the `rig_pilot_sessions` table *once* & set the controller
// Required for The Garage tests to work with `runSQL` (alternatively, could use Tableland SDK)
export async function tableSetup(
  beneficiary: SignerWithAddress,
  tables: TablelandTables
) {
  // Independently deploy the `SQLHelpers` to make it accessible below
  const SQLHelpersFactory = await ethers.getContractFactory("TestSQLHelpers");
  const sqlHelpers = (await SQLHelpersFactory.deploy()) as TestSQLHelpers;
  await sqlHelpers.deployed();
  // Create the table, minted to the `beneficiary` address
  const tx = await tables
    .connect(beneficiary)
    .createTable(
      beneficiary.address,
      sqlHelpers.toCreateFromSchema(
        "id integer primary key, rig_id integer not null, owner text not null, pilot_contract text, pilot_id integer, start_time integer not null, end_time integer",
        "rig_pilot_sessions"
      )
    );
  const receipt = await tx.wait();
  const [event] = receipt.events ?? [];
  const rigPilotSessionsTableId = event.args?.tokenId;
  // Validate the owner and `tokenId`
  expect(await tables.ownerOf(1)).to.be.equal(beneficiary.address);
  expect(rigPilotSessionsTableId).to.equal(BigNumber.from(1));
  // Deploy a faux TablelandController with "allow all" permissions, for simplicity sake
  const FauxController = await ethers.getContractFactory(
    "TestAllowAllTablelandController"
  );
  const fauxController = await (
    await FauxController.connect(beneficiary).deploy()
  ).deployed();
  // Set the "allow all" controller of the table so that the Rigs contract can mutate the table
  await tables
    .connect(beneficiary)
    .setController(
      beneficiary.address,
      rigPilotSessionsTableId,
      fauxController.address
    );
  // Validate the controller was set successfully
  expect(await tables.getController(rigPilotSessionsTableId)).to.be.equal(
    fauxController.address
  );
  // Return the Tableland `tableId`, which is used in the contract deployment
  return rigPilotSessionsTableId;
}
