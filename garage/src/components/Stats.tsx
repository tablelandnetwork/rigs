import React from "react";
import { Heading, Flex, Grid, GridItem, Stack, Text } from "@chakra-ui/react";
import { useStats } from "../hooks/useRigStats";

const StatItem = ({ name, value }: { name: string; value: string }) => {
  return (
    <Stack p={3}>
      <Text>{name}</Text>
      <Flex align="center" justify="center">
        <Text fontSize="4xl">{value}</Text>
      </Flex>
    </Stack>
  );
};

export const Stats = () => {
  const { stats } = useStats();

  return (
    <Flex
      direction="column"
      p={7}
      sx={{ height: "100%", background: "#101E1E", color: "#75B6B5" }}
    >
      <Heading as="h3">Stats</Heading>
      <Grid templateColumns="repeat(3, 1fr)" gap={3}>
        {stats.map(({ name, value }) => {
          return (
            <GridItem key={name} backgroundColor="#162929">
              <StatItem name={name} value={value} />
            </GridItem>
          );
        })}
      </Grid>
    </Flex>
  );
};
