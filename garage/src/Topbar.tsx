import React from "react";
import { Flex, Image } from "@chakra-ui/react";
import logo from "./assets/tableland.svg";

interface TopbarProps {
  children: React.ReactNode;
  mode?: "light" | "dark";
}

export const Topbar = ({ children, mode = "dark" }: TopbarProps) => {
  const bgColor = mode === "dark" ? "primary" : "primaryLight";

  return (
    <Flex
      height="80px"
      width="100%"
      bg={bgColor}
      color="black"
      align="center"
      px={8}
      py={4}
    >
      <Image src={logo} /> Garage
      {children}
    </Flex>
  );
};
