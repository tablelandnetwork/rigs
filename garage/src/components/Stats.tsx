import React from "react";
import { Heading, Flex, Grid, GridItem, Stack, Text } from "@chakra-ui/react";
import { useStats } from "../hooks/useRigStats";

const StatItem = ({ name, value }: { name: string; value: string }) => {
  return (
    <Stack p={3}>
      <Text>{name}</Text>
      <Flex align="center" justify="center">
        <Text fontSize="4xl" lineHeight="100%" py={8}>
          {value}
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
      <Grid templateColumns="repeat(3, 1fr)" gap={3}>
        {stats.map(({ name, value }) => {
          return (
            <GridItem key={name} bgColor="block">
              <StatItem name={name} value={value} />
            </GridItem>
          );
        })}
      </Grid>
    </Flex>
  );
};
