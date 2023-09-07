import React, { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  ListItem,
  OrderedList,
  Show,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber } from "../../utils/fmt";
import { useOpenMissions } from "../../hooks/useMissions";
import { Mission } from "../../types";

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

export const SignManifesto = ({ onAgree }: { onAgree: () => void }) => {
  return (
    <Flex {...MODULE_PROPS} direction="column" gap={8}>
      <Text>
        Welcome, Pioneer. You stand on the precipice of a new frontier, the
        virtual expanse of Tableland. This is not just a metaverse; it's a realm
        of boundless potential, a testament to the power of collective
        imagination, and a beacon of decentralized collaboration.
      </Text>
      <Text>
        By signing this manifesto, you're not merely gaining access to The
        Mission Board; you're integrating into a living, breathing ecosystem. As
        an agent and contributor, you're expanding the limitless horizons of
        Tableland.
      </Text>

      <Heading>Our Pledge</Heading>
      <OrderedList listStylePos="inside" spacing={4}>
        <ListItem>
          <span style={{ fontWeight: "bold" }}>We are Innovators:</span> We
          harness the potential of decentralized technology to accelerate the
          exchange of information across society, leveraging the capabilities of
          Tableland to craft, manage, and transform the virtual realm for the
          betterment of humankind.
        </ListItem>
        <ListItem>
          <span style={{ fontWeight: "bold" }}>We are Stewards:</span> We
          understand that the power to shape the future lies in our hands. We
          pledge to use this power responsibly, to construct a virtual space
          that reflects our shared values and ambitions. We are dedicated to
          cultivating a sustainable, inventive, and inspiring ecosystem within
          Tableland and beyond.
        </ListItem>
        <ListItem>
          <span style={{ fontWeight: "bold" }}>We are Community:</span> We are a
          collective of diverse and unique individuals, bound together by a
          common vision of a new Internet. We value each member of our community
          and nurture an environment of inclusivity, respect, and mutual
          support.
        </ListItem>
      </OrderedList>

      <Heading>Your Role</Heading>
      <Text>
        As a contributor to the Tableland Mission Board, you are a key player in
        this pioneering journey. You will have the opportunity to access
        exclusive opportunities, contribute to the development of the Tableland
        ecosystem, be rewarded for your efforts in Flight Time (FT) and other
        perks, as well as having a voice and the right to vote in community
        decisions.
      </Text>

      <Heading>Code of Conduct</Heading>
      <Text>By signing this manifesto, you agree to:</Text>

      <OrderedList listStylePos="inside" spacing={4}>
        <ListItem>
          <span style={{ fontWeight: "bold" }}>Respect Others:</span> Treat all
          members of the community with respect and kindness. Discrimination,
          harassment, or any form of disrespectful behavior will not be
          tolerated.
        </ListItem>
        <ListItem>
          <span style={{ fontWeight: "bold" }}>Collaborate Openly:</span> Share
          your knowledge, learn from others, and work together to achieve common
          goals. The strength of Tableland lies in the collective intelligence
          of its community.
        </ListItem>
        <ListItem>
          <span style={{ fontWeight: "bold" }}>Uphold Integrity:</span> Be
          honest, be transparent, and uphold the highest standards of integrity.
          Your actions reflect on the entire community.
        </ListItem>
      </OrderedList>
      <Text>
        By signing this manifesto, you are not just joining a mission board; you
        are becoming a part of Tableland's story. We look forward to your
        contributions as we shape the future of this virtual frontier together.
      </Text>

      <Button onClick={onAgree}>I AGREE</Button>
    </Flex>
  );
};

export const MissionBoard = () => {
  const [hasSignedManifesto, setHasSignedManifesto] = useState(false);
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
          <Heading size="xl">Mission Board</Heading>
          <Heading size="sm" mt={2}>
            Complete missions to help us on our mission to make the web better,
            and earn rewards.
          </Heading>
        </Box>
        {!missions && (
          <Box {...MODULE_PROPS}>
            <Spinner />
          </Box>
        )}
        {!hasSignedManifesto && (
          <SignManifesto onAgree={() => setHasSignedManifesto(true)} />
        )}
        {hasSignedManifesto && missions && (
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
        {hasSignedManifesto && missions?.length === 0 && (
          <Box {...MODULE_PROPS}>No active missions.</Box>
        )}
      </VStack>
    </Flex>
  );
};
