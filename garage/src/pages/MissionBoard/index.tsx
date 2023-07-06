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

interface Mission {
  id: string;
  name: string;
}

type ModuleProps = React.ComponentProps<typeof Box> & {
  mission: Mission;
};

const Information = ({ mission, ...props }: ModuleProps) => {
  return (
    <VStack align="stretch" spacing={4} {...props}>
      <HStack align="center" justify="space-between">
        <Heading>{mission.name}</Heading>
      </HStack>
      <Button as={Link} to={`/missions/${mission.id}`}>
        Details
      </Button>
    </VStack>
  );
};

const useOpenMissions = () => {
  return { missions: [] };
};

export const MissionBoard = () => {
  const { missions } = useOpenMissions();

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
          <Heading>Mission Board</Heading>
        </Box>
        {!missions && (
          <Box {...MODULE_PROPS}>
            <Spinner />
          </Box>
        )}
        {missions &&
          missions.map((mission, idx) => (
            <Information
              mission={mission}
              key={`proposal-${idx}`}
              {...MODULE_PROPS}
            />
          ))}
        {missions?.length === 0 && (
          <Box {...MODULE_PROPS}>No active missions.</Box>
        )}
      </VStack>
    </Flex>
  );
};
