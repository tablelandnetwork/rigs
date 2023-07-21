import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Input,
  ListItem,
  OrderedList,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import {
  useAccount,
  useBlockNumber,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import { useParams, Link } from "react-router-dom";
import { TransactionStateAlert } from "../../components/TransactionStateAlert";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { as0xString } from "../../utils/types";
import { Mission, WalletAddress } from "../../types";
import { deployment } from "../../env";
import { useMission } from "../../hooks/useMissions";
import { SubmitMissionModal } from "../../components/SubmitMissionModal";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

interface Submission {
  timestamp: Date;
  address: WalletAddress;
  status: "submitted" | "accepted" | "rejected";
}

type ModuleProps = Omit<React.ComponentProps<typeof Box>, "results"> & {
  mission: Mission;
  submissions: Submission[];
};

const Information = ({ mission, ...props }: ModuleProps) => {
  return (
    <VStack align="stretch" spacing={4} {...props}>
      <Heading>{mission.description}</Heading>
      <Divider pt={4} />
      <Heading pt={4}>Requirements</Heading>
      <OrderedList listStylePos="inside">
        {mission.requirements.map((requirement, i) => (
          <ListItem key={`requirement-${i}`} mb={4}>
            {requirement}
          </ListItem>
        ))}
      </OrderedList>
      <Heading>Deliverables</Heading>
      <OrderedList listStylePos="inside">
        {mission.deliverables.map((deliverable, i) => (
          <ListItem key={`deliverable-${i}`} mb={4}>
            {deliverable.description}
          </ListItem>
        ))}
      </OrderedList>
    </VStack>
  );
};

const Header = ({ mission, ...props }: ModuleProps) => {
  return (
    <VStack align="stretch" spacing={1} {...props}>
      <HStack align="center" justify="space-between">
        <Heading size="xl">{mission.name}</Heading>
      </HStack>
    </VStack>
  );
};

const Submissions = ({ mission, submissions, p, ...props }: ModuleProps) => {
  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <>
      <SubmitMissionModal isOpen={isOpen} onClose={onClose} mission={mission} />
      <VStack align="stretch" spacing={4} pt={p} {...props}>
        <Heading px={p}>Submissions</Heading>
        <Table>
          <Thead>
            <Tr>
              <Th pl={p}>Date</Th>
              <Th>Address</Th>
              <Th pr={p}>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {submissions.map((submission, idx) => {
              return (
                <Tr key={`submission-${idx}`}>
                  <Td pl={p}>{submission.timestamp.toDateString()}</Td>
                  <Td>{truncateWalletAddress(submission.address)}</Td>
                  <Td pr={p}>{submission.status}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Flex px={p} pb={p} justify="stretch">
          <Button flexGrow="1" onClick={onOpen}>
            Submit contribution
          </Button>
        </Flex>
      </VStack>
    </>
  );
};

const useSubmissions = (missionId?: string) => {
  return {
    submissions: [
      {
        timestamp: new Date(Date.parse("2023-07-19T00:00:05Z")),
        address: as0xString("0xCe300C9071947Cec318eF8368132EB33a80B6150")!,
        status: "submitted" as const,
      },
    ],
  };
};

export const MissionDetails = () => {
  const { id } = useParams();

  const { mission } = useMission(id ?? "");
  const { submissions } = useSubmissions(id ?? "");

  return (
    <Flex
      direction="column"
      align="center"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
    >
      {mission && (
        <>
          <Box
            p={GRID_GAP}
            pt={{ base: GRID_GAP, md: GRID_GAP * 2 }}
            maxWidth="1385px"
            width="100%"
          >
            <Header
              mission={mission}
              submissions={submissions}
              {...MODULE_PROPS}
            />
          </Box>
          <Flex
            direction={{ base: "column", lg: "row" }}
            p={GRID_GAP}
            pt={0}
            gap={GRID_GAP}
            align={{ base: "stretch", lg: "start" }}
            maxWidth="1385px"
            width="100%"
            minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
          >
            <Flex
              direction="column"
              gap={GRID_GAP}
              align="stretch"
              width="100%"
            >
              <Information
                mission={mission}
                submissions={submissions}
                {...MODULE_PROPS}
              />
            </Flex>
            <Box flexShrink="0">
              <Submissions
                mission={mission}
                submissions={submissions}
                {...MODULE_PROPS}
              />
            </Box>
          </Flex>
        </>
      )}
      {!mission && <Spinner />}
    </Flex>
  );
};
