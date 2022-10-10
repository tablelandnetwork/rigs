import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button, Flex, Heading, Spinner, VStack, Text } from "@chakra-ui/react";
import { useOwnedRigs } from "../../../hooks/useOwnedRigs";
import { useNFTs, NFT } from "../../../hooks/useNFTs";
import { Rig, Pilot } from "../../../types";
import { RigDisplay } from "../../../components/RigDisplay";
import { findNFT } from "../../../utils/nfts";

const RigListItem = ({ rig, nfts }: { rig: Rig; nfts: NFT[] }) => {
  const currentNFT = rig.currentPilot && findNFT(rig.currentPilot, nfts);

  return (
    <VStack align="start" pb={2} flexShrink="0">
      <RigDisplay rig={rig} width="200px" pilotNFT={currentNFT} />
      <Text>{`#${rig.id}`}</Text>
      <Button
        as={Link}
        variant="outlined-background"
        to={`/rigs/${rig.id}`}
        sx={{ width: "100%" }}
      >
        Details
      </Button>
    </VStack>
  );
};

export const RigsInventory = () => {
  const { rigs } = useOwnedRigs();
  const pilots = useMemo<Pilot[]>(() => {
    if (!rigs) return [];

    return rigs.map((v) => v.currentPilot).filter((v) => v) as Pilot[];
  }, [rigs]);
  const { nfts } = useNFTs(pilots);

  return (
    <VStack
      align="start"
      bgColor="paper"
      p={8}
      sx={{ height: "100%", width: "100%" }}
    >
      <Heading>Rigs {rigs && ` (${rigs.length})`}</Heading>

      {rigs && nfts && (
        <Flex
          gap={4}
          width="100%"
          sx={{
            overflowX: "scroll",
          }}
        >
          {rigs.map((rig, index) => {
            return <RigListItem rig={rig} key={`rig-${index}`} nfts={nfts} />;
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
