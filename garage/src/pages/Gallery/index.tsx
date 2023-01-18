import React from "react";
import { Box, Flex, Heading, Image, Link } from "@chakra-ui/react";
import { TOPBAR_HEIGHT } from "../../Topbar";
import twitterMark from "../../assets/twitter-mark.svg";
import openseaMark from "../../assets/opensea-mark.svg";

const GRID_GAP = 4;

export const Gallery = () => {
  return (
    <>
      <Flex
        direction="column"
        align="center"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT} + 40px)`}
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
          <Heading>Gallery</Heading>
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
          href="https://twitter.com/tableland__"
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
