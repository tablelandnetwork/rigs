module.exports = {
  skipFiles: ["VotingRegistry.sol"],
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  }
}
