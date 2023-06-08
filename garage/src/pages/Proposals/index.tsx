import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { LinkIcon } from "@chakra-ui/icons";
import { useBlockNumber } from "wagmi";
import { Link } from "react-router-dom";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { as0xString } from "../../utils/types";
import { Proposal } from "../../types";
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
      `SELECT * FROM ${proposalsTable} ORDER BY start_block DESC LIMIT 100`
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

const proposalStatus = (
  blockNumber: number | undefined,
  proposal: Proposal | undefined
) => {
  if (!blockNumber || !proposal) return "loading";

  if (blockNumber < proposal.startBlock) return "Not opened yet";

  if (blockNumber > proposal.endBlock) return "Proposal ended";

  return "open";
};

type ModuleProps = React.ComponentProps<typeof Box> & {
  proposal: Proposal;
};

const Information = ({ proposal, ...props }: ModuleProps) => {
  const { data: blockNumber } = useBlockNumber();

  const status = useMemo(
    () => proposalStatus(blockNumber, proposal),
    [blockNumber, proposal]
  );

  // TODO make this better
  return (
    <VStack align="stretch" spacing={4} {...props}>
      <Heading>
        {proposal.name} {status}
      </Heading>
      <Text>{proposal.name}</Text>
      <Text>Ends in 3 days</Text>
    </VStack>
  );
};

export const Proposals = () => {
  const { proposals } = useProposals();

  // TODO add global header, and then a list that just stacks

  return (
    <>
      <script type="module">
        import ReactMarkdown from 'https://esm.sh/react-markdown@7?bundle'
      </script>
      <Flex
        direction="column"
        align="center"
        justify="stretch"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
      >
        <Flex
          direction={{ base: "column", lg: "row" }}
          p={GRID_GAP}
          pt={{ base: GRID_GAP, md: GRID_GAP * 2 }}
          gap={GRID_GAP}
          align={{ base: "stretch", lg: "start" }}
          maxWidth="1385px"
          width="100%"
          minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
        >
          <VStack align="stretch">
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
          </VStack>
        </Flex>
      </Flex>
    </>
  );
};
