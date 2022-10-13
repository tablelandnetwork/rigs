import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Spinner,
  VStack,
} from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useOwnedRigs } from "../../hooks/useOwnedRigs";
import { useRig } from "../../hooks/useRig";
import { useNFTs } from "../../hooks/useNFTs";
import { Topbar } from "../../Topbar";
import { RigDisplay } from "../../components/RigDisplay";
import { FlightLog } from "./modules/FlightLog";
import { Pilots } from "./modules/Pilots";
import { Badges } from "./modules/Badges";
import { RigAttributes } from "./modules/RigAttributes";
import { findNFT } from "../../utils/nfts";

const GRID_GAP = 4;

export const RigDetails = () => {
  const { id } = useParams();
  const { rig } = useRig(id || "");
  const { rigs } = useOwnedRigs();
  const { nfts } = useNFTs(rig?.pilotSessions || []);

  const userOwnsRig = useMemo(() => {
    return !!(rigs && rig && rigs.map((v) => v.id).includes(rig.id));
  }, [rig, rigs]);

  const currentNFT =
    rig?.currentPilot && nfts && findNFT(rig.currentPilot, nfts);

  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      sx={{ width: "100%", height: "100%" }}
    >
      <Topbar>
        <Flex justify="space-between" align="center" width="100%" ml={8}>
          <Button variant="solid" as={Link} to="/dashboard">
            Dashboard
          </Button>
          <ConnectButton />
        </Flex>
      </Topbar>
      <Grid
        templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(2, 1fr)" }}
        pt={GRID_GAP}
        gap={GRID_GAP}
        px={GRID_GAP}
        maxWidth="1385px"
        height="100%"
      >
        {rig && nfts && (
          <>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Box p={4} bgColor="paper">
                  <RigDisplay
                    border={1}
                    borderStyle="solid"
                    borderColor="black"
                    rig={rig}
                    pilotNFT={currentNFT}
                    pilotBorderWidth="3px"
                  />
                </Box>
                <RigAttributes rig={rig} />
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Pilots rig={rig} nfts={nfts} isOwner={userOwnsRig} />
                <Badges rig={rig} nfts={nfts} />
                <FlightLog rig={rig} nfts={nfts} />
              </VStack>
            </GridItem>
          </>
        )}

        {!rig && <Spinner />}
      </Grid>
    </Flex>
  );
};
