import React from "react";
import { Box, Flex, Image } from "@chakra-ui/react";
import pilot from "../assets/trainer-pilot.svg";

export const TrainerPilot = (props: React.ComponentProps<typeof Box>) => {
  return (
    <Flex justify="center" align="center" backgroundColor="primary" {...props}>
      <Image sx={{ width: "80%", height: "auto" }} src={pilot} />
    </Flex>
  );
};
