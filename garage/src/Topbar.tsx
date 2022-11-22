import React from "react";
import { Link } from "react-router-dom";
import { Button, Flex, Image, Show, Spacer, Text } from "@chakra-ui/react";
import { TablelandConnectButton } from "./components/TablelandConnectButton";
import logo from "./assets/tableland.svg";
import { useCurrentRoute } from "./hooks/useCurrentRoute";

export const TOPBAR_HEIGHT = "80px";

export const Topbar = () => {
  const route = useCurrentRoute();

  const isEnter = route?.route.key === "ENTER";
  const bgColor = isEnter ? "primaryLight" : "primary";

  return (
    <Flex
      height={TOPBAR_HEIGHT}
      width="100%"
      bg={bgColor}
      color="black"
      align="center"
      position="sticky"
      top="0"
      zIndex={2}
      px={8}
      py={4}
    >
      <Image
        src={logo}
        sx={{ maxWidth: { base: "50px", md: "100%" } }}
        mr={2}
      />
      <Show above="sm">
        <Text variant="orbitron" fontSize="20">
          Garage
        </Text>
      </Show>
      <Flex justify="space-between" align="center" width="100%" ml={8}>
        {!isEnter ? (
          <Button variant="solid" as={Link} to="/dashboard">
            Dashboard
          </Button>
        ) : (
          <Spacer />
        )}
        <TablelandConnectButton />
      </Flex>
    </Flex>
  );
};
