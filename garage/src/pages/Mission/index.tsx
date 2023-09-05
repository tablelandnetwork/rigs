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
import { useParams, Link } from "react-router-dom";
import { TransactionStateAlert } from "../../components/TransactionStateAlert";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { as0xString } from "../../utils/types";
import { Mission, MissionContribution, WalletAddress } from "../../types";
import { deployment } from "../../env";
import { useMission, useContributions } from "../../hooks/useMissions";
import { useAccount } from "../../hooks/useAccount";
import { SubmitMissionModal } from "../../components/SubmitMissionModal";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

type ModuleProps = Omit<React.ComponentProps<typeof Box>, "results"> & {
  mission: Mission;
  contributions: MissionContribution[];
  refresh: () => void;
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

const prettySubmissionStatus = (
  status: MissionContribution["status"]
): string => {
  switch (status) {
    case "pending_review":
      return "Pending";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

const Contributions = ({
  mission,
  contributions,
  refresh,
  p,
  ...props
}: ModuleProps) => {
  const { address } = useAccount();
  const { isOpen, onClose, onOpen } = useDisclosure();

  const userCanSubmit =
    !mission.contributionsDisabled &&
    !contributions.some(({ contributor, status }) => {
      return (
        contributor.toLowerCase() === address?.toLowerCase() &&
        status === "pending_review"
      );
    });

  return (
    <>
      <SubmitMissionModal
        isOpen={isOpen}
        onClose={onClose}
        mission={mission}
        refresh={refresh}
      />
      <VStack align="stretch" spacing={4} pt={p} {...props}>
        <Heading px={p}>Contributions</Heading>
        {contributions.length > 0 && (
          <Table>
            <Thead>
              <Tr>
                <Th pl={p}>Contributor</Th>
                <Th pr={p}>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {contributions.map((contribution, idx) => {
                const contributor =
                  contribution.contributor.toLowerCase() ===
                  address?.toLowerCase()
                    ? "You"
                    : truncateWalletAddress(contribution.contributor);
                return (
                  <Tr key={`contribution-${idx}`}>
                    <Td pl={p}>{contributor}</Td>
                    <Td pr={p}>
                      {prettySubmissionStatus(contribution.status)}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
        {contributions.length === 0 && (
          <Text px={p} py={4} variant="emptyState">
            This mission has no contributions yet.
          </Text>
        )}
        <Flex px={p} pb={p} justify="stretch">
          <Button flexGrow="1" onClick={onOpen} isDisabled={!userCanSubmit}>
            Submit contribution
          </Button>
        </Flex>
      </VStack>
    </>
  );
};

export const MissionDetails = () => {
  const { id } = useParams();
  const { address } = useAccount();

  const { mission } = useMission(id ?? "");
  const { refresh, contributions } = useContributions(
    id ?? "",
    "filtered",
    address
  );

  console.log({ mission, contributions });

  return (
    <Flex
      direction="column"
      align="center"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
    >
      {mission && contributions && (
        <>
          <Box
            p={GRID_GAP}
            pt={{ base: GRID_GAP, md: GRID_GAP * 2 }}
            maxWidth="1385px"
            width="100%"
          >
            <Header
              mission={mission}
              contributions={contributions}
              refresh={refresh}
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
            <Information
              mission={mission}
              contributions={contributions}
              refresh={refresh}
              {...MODULE_PROPS}
              flexGrow="1"
            />
            <Contributions
              mission={mission}
              contributions={contributions}
              refresh={refresh}
              {...MODULE_PROPS}
              minWidth={{ lg: "300px", xl: "360px" }}
            />
          </Flex>
        </>
      )}
      {!mission && <Spinner />}
    </Flex>
  );
};
