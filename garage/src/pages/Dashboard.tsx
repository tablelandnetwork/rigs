import React from "react";
import { Button, Heading, Flex, Stack, Text } from "@chakra-ui/react";
import { Topbar } from "../Topbar";
import { ConnectButton } from '@rainbow-me/rainbowkit';

export const Dashboard = () => {
  return (
    <Flex direction="column" sx={{ height: "100%", background: "#162929" }}>
      <Topbar backgroundColor="#75B6B5">
        <Flex justify="flex-end" width="100%">
          <ConnectButton />
        </Flex>
      </Topbar>
      <Flex
        direction="column"
        align="center"
        justify="center"
        width="100%"
        height="100%"
      >
      YO
      </Flex>
    </Flex>
  );
};
