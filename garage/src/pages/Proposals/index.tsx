import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Show,
  Spinner,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { useBlockNumber } from "wagmi";
import { Link } from "react-router-dom";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber } from "../../utils/fmt";
import { Proposal, ProposalStatus } from "../../types";
import {
  proposalStatus,
  ProposalStatusBadge,
} from "../../components/ProposalStatusBadge";
import { deployment } from "../../env";

const {
  proposalsTable,
  optionsTable,
  votesTable,
  ftSnapshotTable,
  votingContractAddress,
} = deployment;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

const useProposals = () => {
  const { db } = useTablelandConnection();

  const [proposals, setProposals] = useState<Proposal[]>();

  useEffect(() => {
    let isCancelled = false;

    db.prepare(
      `SELECT
         id,
         name,
         description_cid as "descriptionCid",
         created_at as "createdAt",
         start_block as "startBlock",
         end_block as "endBlock",
         voter_ft_reward as "voterFtReward"
       FROM ${proposalsTable} ORDER BY start_block DESC LIMIT 100`
    )
      .all<Proposal>()
      .then(({ results }) => {
        if (isCancelled) return;

        setProposals(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [setProposals]);

  return { proposals };
};

// TODO show if eligible to vote / if has voted?
const useIsEligibleToVote = (
  address: string | undefined,
  proposalId: number | undefined
) => {
  const { db } = useTablelandConnection();

  const [isEligible, setIsEligible] = useState<boolean>();

  useEffect(() => {
    setIsEligible(undefined);

    // 0 is falsy
    if (!address || proposalId === undefined) return;

    let isCancelled = false;

    db.prepare(
      `SELECT EXISTS(SELECT * FROM ${votesTable} WHERE lower(address) = lower('${address}') AND proposal_id = ${proposalId}) as "isEligible" FROM ${votesTable} LIMIT 1`
    )
      .first<{ isEligible: boolean }>()
      .then((result) => {
        if (isCancelled) return;

        setIsEligible(result.isEligible);
      });

    return () => {
      isCancelled = true;
    };
  }, [address, proposalId, setIsEligible]);

  return { isEligible };
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

  const startsIn = proposal.startBlock - (blockNumber ?? 0);
  const endsIn = proposal.endBlock - (blockNumber ?? 0);
  const ended = (blockNumber ?? 0) - proposal.endBlock;

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
