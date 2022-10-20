import React from "react";
import { Box, Flex, Image, Link } from "@chakra-ui/react";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigsInventory } from "./modules/RigsInventory";
import { Stats } from "./modules/Stats";
import { Activity } from "./modules/Activity";
import twitterMark from "../../assets/twitter-mark.svg";
import openseaMark from "../../assets/opensea-mark.svg";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
};

export const Dashboard = () => {
  return (
    <>
      <Flex
        direction="column"
        align="center"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT}) + 40px`}
        mb="40px"
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
      <Flex
        position="fixed"
        bottom="0"
        bgColor="paper"
        zIndex="2"
        left="0"
        right="0"
        height="40px"
        justify="center"
        align="center"
        gap={2}
        borderTopColor="bg"
        borderTopWidth="1px"
      >
        <Link
          href="htps://twitter.com/tableland__"
          title="Tableland on Twitter"
          isExternal
        >
          <Image src={twitterMark} color="primary" />
        </Link>
        <Link
          href="https://opensea.io/collection/tableland-rigs"
          title="Rigs on OpenSea"
          isExternal
        >
          <Image src={openseaMark} color="primary" />
        </Link>
      </Flex>
    </>
  );
};
