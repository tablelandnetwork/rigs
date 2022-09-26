import React from "react";
import { Flex, Image } from "@chakra-ui/react";
import logo from "./assets/tableland.svg";

interface TopbarProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export const Topbar = ({ children, backgroundColor }: TopbarProps) => {
  return (
    <Flex
      height="80px"
      backgroundColor={backgroundColor ?? "#F4706B"}
      align="center"
      px={8}
      py={4}
    >
      <Image src={logo} /> Garage
      {children}
    </Flex>
  );
};
