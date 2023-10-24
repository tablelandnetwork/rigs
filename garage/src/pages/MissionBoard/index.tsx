import React from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Show,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { TOPBAR_HEIGHT } from "~/Topbar";
import { prettyNumber } from "~/utils/fmt";
import { useOpenMissions } from "~/hooks/useMissions";
import { usePersistentState } from "~/hooks/usePersistentState";
import { Mission } from "~/types";
import { SignManifestoModal } from "~/components/SignManifestoModal";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

type MissionPropertyBoxProps = React.ComponentProps<typeof Box> & {
  title: string;
};

const MissionPropertyBox = ({
  title,
  width,
  children,
}: MissionPropertyBoxProps) => {
  return (
    <>
      <Show below="md">
        <VStack>
          <Text fontWeight="bold">{title}</Text>
          {children}
        </VStack>
      </Show>
      <Show above="md">
        <Box width={width} flexShrink="0">
          {children}
        </Box>
      </Show>
    </>
  );
};

type ModuleProps = React.ComponentProps<typeof Box> & {
  mission: Mission;
};

const TypeWidth = "80px";
const RewardWidth = "100px";
const ContributeWidth = "90px";

const MissionListHeading = ({ p }: React.ComponentProps<typeof Box>) => {
  return (
    <Show above="md">
      <HStack align="center" spacing={8} px={p} paddingTop={8}>
        <Text flexGrow="1">Name</Text>
        <Text width={TypeWidth}>Type</Text>
        <Text width={RewardWidth}>Reward</Text>
        <Text width={ContributeWidth}>Contribute</Text>
      </HStack>
    </Show>
  );
};

const MissionCard = ({ mission, ...props }: ModuleProps) => {
  const MissionProperties = () => {
    return (
      <>
        <MissionPropertyBox title="Type" width={TypeWidth}>
          {mission.tags.map((tag, i) => (
            <Badge
              fontSize="1.0em"
              key={`mission-${mission.id}-${tag}-${i}`}
              mr={2}
            >
              {tag}
            </Badge>
          ))}
        </MissionPropertyBox>
        <MissionPropertyBox title="Reward" width={RewardWidth}>
          <Text whiteSpace="nowrap">{`${prettyNumber(
            mission.rewards[0].amount
          )} ${mission.rewards[0].currency}`}</Text>
        </MissionPropertyBox>
        <MissionPropertyBox title="Contribute" width={ContributeWidth}>
          <Button as={Link} to={`/missions/${mission.id}`}>
            Details
          </Button>
        </MissionPropertyBox>
      </>
    );
  };

  return (
    <>
      <Show above="md">
        <HStack align="center" spacing={8} {...props}>
          <Heading flexGrow="1">{mission.name}</Heading>
          <MissionProperties />
        </HStack>
      </Show>
      <Show below="md">
        <VStack {...props} spacing={4} align="stretch">
          <Heading flexGrow="1">{mission.name}</Heading>
          <HStack justify="space-between" align="stretch">
            <MissionProperties />
          </HStack>
        </VStack>
      </Show>
    </>
  );
};

export const MissionBoard = () => {
  const [hasSignedManifesto, setHasSignedManifesto] = usePersistentState(
    "HAS_SIGNED_MB_MANIFESTO",
    false
  );

  const { missions } = useOpenMissions();

  return (
    <>
      <SignManifestoModal
        isOpen={!hasSignedManifesto}
        onAgree={() => setHasSignedManifesto(true)}
      />

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
            <Heading size="xl">Mission Board</Heading>
            <Heading size="sm" mt={2}>
              Complete missions to help us on our mission to make the web
              better, and earn rewards.
            </Heading>
          </Box>
          {!missions && (
            <Box {...MODULE_PROPS}>
              <Spinner />
            </Box>
          )}
          {missions && (
            <>
              <MissionListHeading {...MODULE_PROPS} />
              {missions.map((mission, idx) => (
                <MissionCard
                  mission={mission}
                  key={`proposal-${idx}`}
                  {...MODULE_PROPS}
                />
              ))}
            </>
          )}
          {missions?.length === 0 && (
            <Box {...MODULE_PROPS}>No active missions.</Box>
          )}
        </VStack>
      </Flex>
    </>
  );
};
