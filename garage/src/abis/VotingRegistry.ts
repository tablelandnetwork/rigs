export const abi = [
  {
    inputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "descriptionCid",
        type: "string",
      },
      {
        internalType: "enum IVotingRegistry.VotingSystem",
        name: "votingSystem",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "voterReward",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "startBlockNumber",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "endBlockNumber",
        type: "uint256",
      },
      {
        internalType: "string[]",
        name: "options",
        type: "string[]",
      },
    ],
    name: "createProposal",
    outputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        internalType: "uint256[]",
        name: "alternatives",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "weights",
        type: "uint256[]",
      },
      {
        internalType: "string[]",
        name: "comments",
        type: "string[]",
      },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "hasRole",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
