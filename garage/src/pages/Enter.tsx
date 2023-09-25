import React, { useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { Button, Heading, Flex, Stack, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import desert from "~/assets/desert-bg.png";
import { TOPBAR_HEIGHT } from "~/Topbar";

export const Enter = () => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) navigate("/dashboard");
    }, 300);

    return () => {
      clearInterval(interval);
    };
  }, [isConnected, navigate]);

  const navigateToDashboard = useCallback(() => {
    navigate("/dashboard");
  }, [navigate]);

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      sx={{
        backgroundImage: desert,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
    >
      <Stack
        maxWidth="700px"
        align="center"
        color="white"
        px={4}
        textAlign="center"
      >
        <Heading as="h1" variant="orbitron" fontSize="64">
          Enter the Garage.
        </Heading>
        <Text fontSize="16" pt={6} pb={12} maxWidth="445px">
          Tired? Thirsty? Sunburned? Come take a break from the heat and hang
          with other Rig owners from across Tableland. Learn how to pilot your
          Rig to earn flight-time and badges in the Garage.
        </Text>
        <Button
          variant="connect"
          height="70px"
          minWidth="300px"
          fontSize="20px"
          onClick={navigateToDashboard}
        >
          Enter the garage
        </Button>
      </Stack>
    </Flex>
  );
};
