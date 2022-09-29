import React from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Flex,
  Heading,
  Image,
  Spinner,
  VStack,
  Text,
} from "@chakra-ui/react";
import { useOwnedRigs } from "../hooks/useOwnedRigs";
import { useRigImageUrls } from "../hooks/useRigImageUrls";
import { Rig } from "../types";

const RigDisplay = ({ rig }: { rig: Rig }) => {
  const { thumb } = useRigImageUrls(rig);
  return (
    <VStack align="start" pb={2} flexShrink="0">
      <Image src={thumb} width="200px" />
      <Text>{`#${rig.id}`}</Text>
      <Button as={Link} to={`/rigs/${rig.id}`} sx={{ width: "100%" }}>Details</Button>
    </VStack>
  );
};

export const RigsInventory = () => {
  const { rigs } = useOwnedRigs();

  return (
    <VStack
      align="start"
      bgColor="paper"
      p={7}
      sx={{ height: "100%", width: "100%" }}
    >
      <Heading as="h3">Rigs {rigs && ` (${rigs.length})`}</Heading>

      <Flex
        gap={4}
        sx={{
          overflowX: "scroll",
        }}
      >
        {rigs &&
          rigs.map((rig, index) => {
            return <RigDisplay rig={rig} key={`rig-${index}`} />;
          })}
        {!rigs && <Spinner />}
      </Flex>
    </VStack>
  );
};
