import React, { useMemo } from "react";
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
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber } from "../../utils/fmt";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

interface MissionDeliverable {
  name: string;
  description: string;
}

interface MissionReward {
  amount: number;
  currency: string;
}

interface Mission {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  tags: string[];
  deliverables: MissionDeliverable[];
  reward: MissionReward;
  expiresAt?: Date;
}

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
            <Badge fontSize="1.0em" key={`mission-${mission.id}-${tag}-${i}`}>
              {tag}
            </Badge>
          ))}
        </MissionPropertyBox>
        <MissionPropertyBox title="Reward" width={RewardWidth}>
          <Text whiteSpace="nowrap">{`${prettyNumber(mission.reward.amount)} ${
            mission.reward.currency
          }`}</Text>
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

const useOpenMissions = () => {
  return {
    missions: [
      {
        id: "id-1",
        name: "Amplify Tableland with a Quote Retweet Earning 10+ Likes",
        description:
          "Spread the word about Tableland by quote retweeting one of our tweets and gaining 10+ likes.",
        requirements: [
          "The quote retweet must be relevant and add value to the original Tableland tweet. It could provide additional insights, personal experiences, or constructive comments.",
          "The likes must come from genuine, non-bot Twitter accounts. Any indication of artificial likes will disqualify the entry.",
        ],
        tags: ["Media"],
        deliverables: [
          {
            name: "Link",
            description:
              "A link to the quote retweet that meets the required criteria.",
          },
          {
            name: "Screenshot",
            description:
              "A screenshot showing the quote retweet with 10+ likes. Please ensure the number of likes and the content of the quote retweet are clearly visible in the screenshot.",
          },
        ],
        reward: { amount: 300_000, currency: "FT" },
      },
      {
        id: "id-2",
        name: "100+ Likes for Original Tweet Promoting Tableland or Rigs",
        description:
          "Original tweet that highlights unique aspects of Tableland and/or Rigs. Goal is to create a tweet that resonates with the community and garners 100+ likes.",
        requirements: [
          "The tweet must contain original content about Tableland and/or Rigs. It could be about your personal experience, the project's unique features, or its impact on the community.",
          "The likes must come from genuine, non-bot Twitter accounts. Any indication of artificial likes will disqualify the entry.",
        ],
        tags: ["Media"],
        deliverables: [
          {
            name: "Link",
            description:
              "A link to the tweet that meets the required criteria.",
          },
          {
            name: "Screenshot",
            description:
              "A screenshot showing the tweet with 100+ likes. Please ensure the number of likes and the content of the tweet are clearly visible in the screenshot.",
          },
        ],
        reward: { amount: 3_500_000, currency: "FT" },
      },
      {
        id: "id-3",
        name: "Tableland Integration Guides for New Protocols",
        description:
          "Comprehensive technical guides that detail the process of integrating Tableland with a protocol not yet covered in our existing documentation.",
        requirements: [
          "The guide should provide detailed, step-by-step instructions on how to integrate Tableland with another technology stack. This includes initial setup, making and handling requests, security considerations, and error handling.",
          "All submissions must contain clear explanations, working code snippets, and best practice advice.",
          "The guide must cover an integration not already outlined in our existing documentation.",
        ],
        tags: ["Showcase"],
        deliverables: [
          {
            name: "Link",
            description:
              "A comprehensive technical integration document. This should include a clear, step-by-step guide for integrating Tableland into another technology stack.",
          },
          {
            name: "Link",
            description:
              "Working code samples. These should illustrate how to perform tasks and should be accompanied by explanations to ensure they are understandable and replicable.",
          },
        ],
        reward: { amount: 2_000_000, currency: "FT" },
      },
    ],
  };
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
  );
};
