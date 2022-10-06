import React from "react";
import {
  Heading,
  Flex,
  GridItem,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useStats } from "../../../hooks/useRigStats";

const StatItem = ({ name, value }: { name: string; value: number }) => {
  return (
    <Stack p={3}>
      <Text noOfLines={1}>{name}</Text>
      <Flex align="center" justify="center">
        <Text fontSize="4xl" lineHeight="100%" py={8} noOfLines={1}>
          {value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </Text>
      </Flex>
    </Stack>
  );
};

export const Stats = () => {
  const { stats } = useStats();

  return (
    <Flex direction="column" p={8} bgColor="paper" sx={{ height: "100%" }}>
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
