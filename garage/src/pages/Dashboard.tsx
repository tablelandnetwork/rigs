import React from "react";
import { Button, Heading, Flex, Stack, Text } from "@chakra-ui/react";
import { Topbar } from "../Topbar";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Stats } from "../components/Stats";
import { Activity } from "../components/Activity";

export const Dashboard = () => {
  return (
    <Flex direction="column" sx={{ height: "100%", background: "#162929" }}>
      <Topbar backgroundColor="#75B6B5">
        <Flex justify="flex-end" width="100%">
          <ConnectButton />
        </Flex>
      </Topbar>
      <Flex
        p={8}
        direction="row"
        gap={4}
        align="center"
        justify="center"
        width="100%"
        height="100%"
      >
        <Stats />
        <Activity />
      </Flex>
    </Flex>
  );
};
