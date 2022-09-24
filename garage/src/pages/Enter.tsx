import React from "react";
import { Box, Button, Heading, Flex, Stack, Text } from "@chakra-ui/react";

export const Enter = () => {
  return (
    <Flex direction="column" sx={{ width: "100%", height: "100%" }}>
      <Box>Tableland</Box>
      <Flex
        direction="column"
        align="center"
        justify="center"
        width="100%"
        height="100%"
      >
        <Stack maxWidth="650px" align="center">
          <Heading as="h1">Enter the Garage</Heading>
          <Text textAlign="center">
            Tired? Thirsty? Sunburned? Come take a break from the heat and hang
            with other Rig owners from across Tableland. Learn how to pilot your
            Rig to earn flight-time and badges in the Garage.
          </Text>
          <Button>Connect Wallet</Button>
        </Stack>
      </Flex>
    </Flex>
  );
};
