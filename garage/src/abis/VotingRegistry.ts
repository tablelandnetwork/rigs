export const abi = [
  {
    inputs: [
      {
        internalType: "string[]",
        name: "alternatives",
        type: "string[]",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "voterFtReward",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "startBlock",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "endBlock",
        type: "uint256",
      },
    ],
    name: "createProposal",
    outputs: [],
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
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
