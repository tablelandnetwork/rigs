import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigsInventory } from "./modules/RigsInventory";
import { Stats } from "./modules/Stats";
import { Activity } from "./modules/Activity";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
};

export const Dashboard = () => {
  return (
    <Flex
      direction="column"
      align="center"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
    >
      <Flex
        direction={{ base: "column", lg: "row" }}
        p={GRID_GAP}
        gap={GRID_GAP}
        align={{ base: "stretch", lg: "start" }}
        maxWidth="1385px"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
      >
        <Flex direction="column" gap={GRID_GAP} align="stretch" width="100%">
          <RigsInventory {...MODULE_PROPS} />
          <Stats {...MODULE_PROPS} />
        </Flex>
        <Box>
          <Activity {...MODULE_PROPS} />
        </Box>
      </Flex>
    </Flex>
  );
};
