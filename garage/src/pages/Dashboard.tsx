import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Topbar } from "../Topbar";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RigsInventory } from "../components/RigsInventory";
import { Stats } from "../components/Stats";
import { Activity } from "../components/Activity";

const GRID_GAP = 4;

export const Dashboard = () => {
  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      sx={{ width: "100%", height: "100%", background: "#162929" }}
    >
      <Topbar backgroundColor="#75B6B5">
        <Flex justify="flex-end" width="100%">
          <ConnectButton />
        </Flex>
      </Topbar>
      <Flex
        direction="row"
        pt={GRID_GAP}
        gap={GRID_GAP}
        align="stretch"
        maxWidth="1200px"
        height="100%"
      >
        <Flex
          direction="column"
          gap={GRID_GAP}
          flexGrow="2"
          align="stretch"
          width="100%"
          height="100%"
        >
          <RigsInventory />
          <Stats />
        </Flex>
        <Box flexGrow="1" flexShrink="0">
          <Activity />
        </Box>
      </Flex>
    </Flex>
  );
};
