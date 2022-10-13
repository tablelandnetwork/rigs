import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Topbar } from "../../Topbar";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RigsInventory } from "./modules/RigsInventory";
import { Stats } from "./modules/Stats";
import { Activity } from "./modules/Activity";

const GRID_GAP = 4;

const MODULE_PROPS = {
  p: 8,
  bgColor: "paper",
};

export const Dashboard = () => {
  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      sx={{ width: "100%", height: "100%" }}
    >
      <Topbar>
        <Flex justify="flex-end" width="100%">
          <ConnectButton />
        </Flex>
      </Topbar>
      <Flex
        direction={{ base: "column", lg: "row" }}
        pt={GRID_GAP}
        gap={GRID_GAP}
        px={GRID_GAP}
        align={{ base: "stretch", lg: "start" }}
        maxWidth="1385px"
        width="100%"
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
          <RigsInventory {...MODULE_PROPS} />
          <Stats {...MODULE_PROPS} />
        </Flex>
        <Box flexGrow="1" flexShrink="0">
          <Activity {...MODULE_PROPS} />
        </Box>
      </Flex>
    </Flex>
  );
};
