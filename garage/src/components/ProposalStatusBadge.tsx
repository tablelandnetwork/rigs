import React from "react";
import { useBlockNumber } from "wagmi";
import { Badge } from "@chakra-ui/react";
import { Proposal, ProposalStatus } from "~/types";
import { secondaryChain } from "~/env";

export const proposalStatus = (
  blockNumber: bigint | undefined,
  proposal: Proposal | undefined
) => {
  if (!blockNumber || !proposal) return ProposalStatus.Loading;

  if (blockNumber < proposal.startBlock) return ProposalStatus.NotOpened;

  if (blockNumber > proposal.endBlock) return ProposalStatus.Ended;

  return ProposalStatus.Open;
};

export const ProposalStatusBadge = ({ proposal }: { proposal: Proposal }) => {
  const { data: blockNumber } = useBlockNumber({ chainId: secondaryChain.id });
  const status = proposalStatus(blockNumber, proposal);

  return (
    <Badge
      fontSize="1em"
      colorScheme={status === ProposalStatus.Open ? "green" : "yellow"}
    >
      {status}
    </Badge>
  );
};
