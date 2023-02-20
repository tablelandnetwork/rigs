import React from "react";
import { Flex, Image, Link } from "@chakra-ui/react";
import twitterMark from "../assets/twitter-mark.svg";
import openseaMark from "../assets/opensea-mark.svg";

export const Footer = () => {
  return (
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
  );
};
