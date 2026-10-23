module.exports = {
  skipFiles: [
    "VotingRegistry.sol",
    "MissionsManager.sol",
    "TablelandRigPilots.sol",
    "DelegateCashMock.sol",
    "test/TablelandTablesMock.sol",
    "test/legacy/ITablelandRigsLegacy.sol",
    "test/legacy/TablelandRigsLegacy.sol",
  ],
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  }
}
