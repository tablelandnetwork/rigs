import React from "react";
import { Flex, Link, useToken } from "@chakra-ui/react";
import { RoundSvgIcon } from "./RoundSvgIcon";
import { ReactComponent as TwitterMark } from "../assets/twitter-mark.svg";
import { ReactComponent as OpenseaMark } from "../assets/opensea-mark.svg";

export const Footer = () => {
  const [primaryColor] = useToken("colors", ["primary"]);

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
        sx={{ fill: primaryColor, _hover: { fill: "#7ddbda" } }}
      >
        <TwitterMark width="20px" height="20px" />
      </Link>
      <Link
        href="https://opensea.io/collection/tableland-rigs"
        title="Rigs on OpenSea"
        isExternal
      >
        <RoundSvgIcon Component={OpenseaMark} size={20} />
      </Link>
    </Flex>
  );
};
