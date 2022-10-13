import React from "react";
import {
  Box,
  Heading,
  Flex,
  GridItem,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useStats } from "../../../hooks/useRigStats";
import { prettyNumber } from "../../../utils/fmt";

const StatItem = ({ name, value }: { name: string; value: number }) => {
  return (
    <Stack p={3} borderRadius="3px">
      <Text noOfLines={1}>{name}</Text>
      <Flex align="center" justify="center">
        <Text fontSize="4xl" lineHeight="100%" py={8} noOfLines={1}>
          {prettyNumber(value)}
        </Text>
      </Flex>
    </Stack>
  );
};

export const Stats = (props: React.ComponentProps<typeof Box>) => {
  const { stats } = useStats();

  return (
    <Flex direction="column" sx={{ height: "100%" }} {...props}>
      <Heading mb={4}>Stats</Heading>
      <SimpleGrid minChildWidth="260px" gap={3}>
        {stats &&
          stats.map(({ name, value }) => {
            return (
              <GridItem key={name} bgColor="block">
                <StatItem name={name} value={value} />
              </GridItem>
            );
          })}
      </SimpleGrid>
    </Flex>
  );
};
