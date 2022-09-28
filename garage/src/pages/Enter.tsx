import React, { useEffect } from "react";
import { Heading, Flex, Stack, Text } from "@chakra-ui/react";
import { Topbar } from "../Topbar";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import desert from "../assets/desert-bg.png";

export const Enter = () => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (isConnected) navigate("/dashboard");
  }, [isConnected, navigate]);

  return (
    <Flex
      direction="column"
      sx={{
        width: "100%",
        height: "100%",
        backgroundImage: desert,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Topbar>
        <Flex justify="flex-end" width="100%">
          <ConnectButton />
        </Flex>
      </Topbar>
      <Flex
        direction="column"
        align="center"
        justify="center"
        width="100%"
        height="100%"
      >
        <Stack maxWidth="650px" align="center" color="white">
          <Heading as="h1">Enter the Garage</Heading>
          <Text textAlign="center">
            Tired? Thirsty? Sunburned? Come take a break from the heat and hang
            with other Rig owners from across Tableland. Learn how to pilot your
            Rig to earn flight-time and badges in the Garage.
          </Text>
          <ConnectButton />
        </Stack>
      </Flex>
    </Flex>
  );
};