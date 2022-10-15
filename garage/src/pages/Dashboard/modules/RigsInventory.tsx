import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
  Grid,
  GridItem,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useOwnedRigs } from "../../../hooks/useOwnedRigs";
import { useNFTs, NFT } from "../../../hooks/useNFTs";
import { Rig, Pilot } from "../../../types";
import { RigDisplay } from "../../../components/RigDisplay";
import { findNFT } from "../../../utils/nfts";

const RigListItem = ({ rig, nfts }: { rig: Rig; nfts: NFT[] }) => {
  const currentNFT = rig.currentPilot && findNFT(rig.currentPilot, nfts);

  return (
    <GridItem>
      <VStack align="start" pb={2} flexShrink="0">
        <RigDisplay rig={rig} borderRadius="3px" pilotNFT={currentNFT} />
        <Flex width="100%" justify="space-between">
          <Text>{`#${rig.id}`}</Text>
          <Text>{rig.currentPilot && "In-flight"}</Text>
        </Flex>
        <Button
          as={Link}
          variant="outlined-background"
          to={`/rigs/${rig.id}`}
          sx={{ width: "100%" }}
        >
          Details
        </Button>
      </VStack>
    </GridItem>
  );
};

export const RigsInventory = (props: React.ComponentProps<typeof Box>) => {
  const { rigs } = useOwnedRigs();
  const pilots = useMemo(() => {
    if (!rigs) return;

    return rigs.map((v) => v.currentPilot).filter((v) => v) as Pilot[];
  }, [rigs]);
  const { nfts } = useNFTs(pilots);

  return (
    <VStack align="start" {...props} sx={{ height: "100%", width: "100%" }}>
      <Flex />
      <Heading>Rigs {rigs && ` (${rigs.length})`}</Heading>

      {rigs && nfts && (
        <Grid
          gap={4}
          templateColumns={{
            base: "repeat(1, 1fr)",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            xl: "repeat(4, 1fr)",
          }}
        >
          {rigs.map((rig, index) => {
            return <RigListItem rig={rig} key={`rig-${index}`} nfts={nfts} />;
          })}
        </Grid>
      )}

      {rigs && rigs.length === 0 && (
        <Text variant="emptyState" pt={8}>
          You don't own any Rigs.
        </Text>
      )}

      {!rigs && (
        <Flex width="100%" height="200px" align="center" justify="center">
          <Spinner />
        </Flex>
      )}
    </VStack>
  );
};
