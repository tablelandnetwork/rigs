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
      <Button as={Link} to={`/rigs/${rig.id}`} sx={{ width: "100%" }}>
        Details
      </Button>
    </VStack>
  );
};

export const RigsInventory = () => {
  const { rigs } = useOwnedRigs();

  return (
    <VStack
      align="start"
      bgColor="paper"
      p={8}
      sx={{ height: "100%", width: "100%" }}
    >
      <Heading>Rigs {rigs && ` (${rigs.length})`}</Heading>

      {rigs && (
        <Flex
          gap={4}
          width="100%"
          sx={{
            overflowX: "scroll",
          }}
        >
          {rigs.map((rig, index) => {
            return <RigDisplay rig={rig} key={`rig-${index}`} />;
          })}
        </Flex>
      )}

      {!rigs && (
        <Flex width="100%" height="200px" align="center" justify="center">
          <Spinner />
        </Flex>
      )}
    </VStack>
  );
};
