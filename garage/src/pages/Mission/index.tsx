import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Alert,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Input,
  Progress,
  Spinner,
  Stat,
  StatLabel,
  StatHelpText,
  Table,
  Thead,
  Tbody,
  Td,
  Th,
  Text,
  Tr,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { ChatIcon } from "@chakra-ui/icons";
import {
  useAccount,
  useBlockNumber,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import { useParams, Link } from "react-router-dom";
import { TransactionStateAlert } from "../../components/TransactionStateAlert";
import {
  ProposalStatusBadge,
  proposalStatus,
} from "../../components/ProposalStatusBadge";
import { useAddressVotingPower } from "../../hooks/useAddressVotingPower";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { as0xString } from "../../utils/types";
import { ProposalWithOptions, ProposalStatus } from "../../types";
import { deployment } from "../../env";
import { abi } from "../../abis/VotingRegistry";

const { votingContractAddress } = deployment;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

type ModuleProps = Omit<React.ComponentProps<typeof Box>, "results"> & {
  proposal: ProposalWithOptions;
};

const Information = ({ proposal, results, p, ...props }: ModuleProps) => {
  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Information</Heading>
      <Table>
        <Tbody>
          <Tr>
            <Td pl={p}>Start block</Td>
            <Td pr={p} isNumeric>
              {proposal.startBlock}
            </Td>
          </Tr>
          <Tr>
            <Td pl={p}>End block</Td>
            <Td pr={p} isNumeric>
              {proposal.endBlock}
            </Td>
          </Tr>
          <Tr>
            <Td pl={p}>Voting Reward</Td>
            <Td pr={p} isNumeric>
              {prettyNumber(proposal.voterFtReward)} FT
            </Td>
          </Tr>
          <Tr>
            <Td pl={p}>Total FT in snapshot</Td>
            <Td pr={p} isNumeric>
              {prettyNumber(proposal.totalFt)} FT
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </VStack>
  );
};

const truncateChoiceString = (s: string, l: number = 80) =>
  s.slice(0, l) + (s.length > l ? "..." : "");

const Results = ({ proposal, results, ...props }: ModuleProps) => {
  const { data: blockNumber } = useBlockNumber();

  const totalResults = results.reduce((acc, { result }) => acc + result, 0);

  const title = useMemo(() => {
    if (proposalStatus(blockNumber, proposal) === ProposalStatus.Open)
      return "Current result";

    return "Result";
  }, [blockNumber, proposal]);

  return (
    <VStack align="stretch" spacing={4} {...props}>
      <Heading>{title}</Heading>
      <Table variant="unstyled">
        <Tbody>
          {results &&
            results.map(({ description, result, optionId }) => {
              const percent = result === 0 ? 0 : (result / totalResults) * 100;
              return (
                <React.Fragment key={`option-${optionId}`}>
                  <Tr px="0">
                    <Td px="0" pb="0">
                      {description}
                    </Td>
                    <Td
                      isNumeric
                      px="0"
                      pb="0"
                      textAlign="end"
                    >{`${prettyNumber(result)} FT - ${Math.round(
                      percent
                    )}%`}</Td>
                  </Tr>
                  <Tr px="0">
                    <Td colSpan={2} px="0">
                      <Progress value={percent} />
                    </Td>
                  </Tr>
                </React.Fragment>
              );
            })}
        </Tbody>
      </Table>
      {results.length === 0 && (
        <Box>
          <Text variant="emptyState">No result.</Text>
        </Box>
      )}
    </VStack>
  );
};

const Header = ({ proposal, results, ...props }: ModuleProps) => {
  return (
    <VStack align="stretch" spacing={1} {...props}>
      <HStack align="center" justify="space-between">
        <Heading size="xl">{proposal.name}</Heading>
        <ProposalStatusBadge proposal={proposal} />
      </HStack>
      <Box paddingTop={6} />
      <Divider />
      <Box paddingTop={6} />
    </VStack>
  );
};

const useMission = (id: string) => {
  return {
    mission: {
      id: "id-1",
      name: "Mission #1",
    },
  };
};

export const Mission = () => {
  const { id } = useParams();

  const { data: blockNumber } = useBlockNumber();
  const { mission } = useMission(id ?? "");

  return (
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
        {mission && (
          <>
            <Flex
              direction="column"
              gap={GRID_GAP}
              align="stretch"
              width="100%"
            >
              <Header {...mission} {...MODULE_PROPS} />
            </Flex>
            <Flex
              direction="column"
              gap={GRID_GAP}
              align="stretch"
              minWidth="380px"
            >
              <Information {...proposalData} {...MODULE_PROPS} />
              <Results {...proposalData} {...MODULE_PROPS} />
            </Flex>
          </>
        )}
      </Flex>
      {!mission && <Spinner />}
    </Flex>
  );
};
