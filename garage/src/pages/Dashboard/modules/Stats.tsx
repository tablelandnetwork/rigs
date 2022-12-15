import React from "react";
import {
  Box,
  Heading,
  Flex,
  GridItem,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  Tabs,
  TabList,
  TabPanel,
  TabPanels,
  Text,
} from "@chakra-ui/react";
import { useAccount, useBlockNumber } from "wagmi";
import { useAccountStats, useStats, Stat } from "../../../hooks/useRigStats";
import { prettyNumber } from "../../../utils/fmt";

const StatItem = ({ name, value }: { name: string; value: number }) => {
  return (
    <Stack p={3} borderRadius="3px">
      <Text noOfLines={1}>{name}</Text>
      <Flex align="center" justify="center">
        <Text
          fontSize="4xl"
          py={8}
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={prettyNumber(value)}
        >
          {prettyNumber(value)}
        </Text>
      </Flex>
    </Stack>
  );
};

const StatGrid = ({ stats }: { stats?: Stat[] }) => {
  return (
    <SimpleGrid minChildWidth="260px" gap={3}>
      {stats &&
        stats.map(({ name, value }) => {
          return (
            <GridItem key={name} bgColor="block">
              <StatItem name={name} value={value} />
            </GridItem>
          );
        })}
      {!stats && (
        <Flex justify="center">
          <Spinner />
        </Flex>
      )}
    </SimpleGrid>
  );
};

export const Stats = (props: React.ComponentProps<typeof Box>) => {
  const { address } = useAccount();
  const { data: currentBlockNumber } = useBlockNumber();
  const { stats } = useStats(currentBlockNumber);
  const { stats: accountStats } = useAccountStats(currentBlockNumber, address);

  return (
    <Flex direction="column" sx={{ height: "100%" }} {...props}>
      <Heading mb={4}>Stats</Heading>
      <Tabs>
        <TabList>
          <Tab>Global</Tab>
          <Tab>You</Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <StatGrid stats={stats} />
          </TabPanel>
          <TabPanel px={0}>
            <StatGrid stats={accountStats} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>
  );
};
