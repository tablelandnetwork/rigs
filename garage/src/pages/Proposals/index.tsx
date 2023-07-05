import React, { useMemo } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useBlockNumber } from "wagmi";
import { Link } from "react-router-dom";
import { useProposals } from "../../hooks/useProposals";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber } from "../../utils/fmt";
import { Proposal, ProposalStatus } from "../../types";
import {
  proposalStatus,
  ProposalStatusBadge,
} from "../../components/ProposalStatusBadge";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

type ModuleProps = React.ComponentProps<typeof Box> & {
  proposal: Proposal;
};

const Information = ({ proposal, ...props }: ModuleProps) => {
  const { data: blockNumber } = useBlockNumber();

  const status = useMemo(() => proposalStatus(blockNumber, proposal), [
    blockNumber,
    proposal,
  ]);

  const startsIn = proposal.startBlock - Number(blockNumber ?? 0);
  const endsIn = proposal.endBlock - Number(blockNumber ?? 0);
  const ended = Number(blockNumber ?? 0) - proposal.endBlock;

  return (
    <VStack align="stretch" spacing={4} {...props}>
      <HStack align="center" justify="space-between">
        <Heading>{proposal.name}</Heading>
        <ProposalStatusBadge proposal={proposal} />
      </HStack>
      <Text>
        Voting Reward: <b>{prettyNumber(proposal.voterFtReward)} FT</b>
      </Text>
      {status === ProposalStatus.Open && (
        <Text>
          Ends in: <b>{endsIn} blocks</b>
        </Text>
      )}
      {status === ProposalStatus.NotOpened && (
        <Text>
          Opens in: <b>{startsIn} blocks</b>
        </Text>
      )}
      {status === ProposalStatus.Ended && (
        <Text>
          Ended: <b>{ended} blocks</b> ago
        </Text>
      )}
      <Button as={Link} to={`/proposals/${proposal.id}`}>
        Details
      </Button>
    </VStack>
  );
};

export const Proposals = () => {
  const { proposals } = useProposals();

  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
    >
      <VStack
        align="stretch"
        pt={{ base: GRID_GAP, md: GRID_GAP * 2 }}
        maxWidth="900px"
        width="100%"
        gap={GRID_GAP}
      >
        <Box {...MODULE_PROPS}>
          <Heading>Proposals</Heading>
        </Box>
        {!proposals && (
          <Box {...MODULE_PROPS}>
            <Spinner />
          </Box>
        )}
        {proposals &&
          proposals.map((proposal, idx) => (
            <Information
              proposal={proposal}
              key={`proposal-${idx}`}
              {...MODULE_PROPS}
            />
          ))}
        {proposals?.length === 0 && (
          <Box {...MODULE_PROPS}>No proposals created.</Box>
        )}
      </VStack>
    </Flex>
  );
};
