import React from "react";
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Rig } from "../../../types";
import { NFT } from "../../../hooks/useNFTs";
import { RigDisplay } from "../../../components/RigDisplay";
import { findNFT } from "../../../utils/nfts";

interface RigsGridProps extends React.ComponentProps<typeof Box> {
  rigs?: Rig[];
  nfts?: NFT[];
  gap: number;
}

export const RigsGrid = ({ rigs, nfts, gap, p, ...props }: RigsGridProps) => {
  return (
    <Box p={p} {...props}>
      <Heading pb={p}>Rigs ({rigs?.length ?? 0})</Heading>
      <Grid
        templateColumns={{
          base: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
          xl: "repeat(4, 1fr)",
        }}
        gap={gap}
      >
        {rigs &&
          rigs.map((rig, index) => {
            const currentNFT =
              rig.currentPilot && nfts && findNFT(rig.currentPilot, nfts);
            return (
              <GridItem key={index}>
                <VStack align="start" pb={2} flexShrink="0">
                  <Link
                    to={`/rigs/${rig.id}`}
                    style={{ position: "relative", display: "block" }}
                  >
                    <RigDisplay
                      border={1}
                      borderStyle="solid"
                      borderColor="black"
                      borderRadius="3px"
                      rig={rig}
                      pilotNFT={currentNFT}
                      pilotBorderWidth="3px"
                    />
                  </Link>
                  <Flex width="100%" justify="space-between">
                    <Text>{`#${rig.id}`}</Text>
                    <Text>{rig.currentPilot && "In-flight"}</Text>
                  </Flex>
                </VStack>
              </GridItem>
            );
          })}
      </Grid>
      {rigs?.length === 0 && (
        <Text variant="emptyState" pt={8}>
          This wallet doesn't own any Rigs.
        </Text>
      )}
      {(!rigs || !nfts) && (
        <Flex justify="center" width="100%" align="center" height="200px">
          <Spinner />
        </Flex>
      )}
    </Box>
  );
};
