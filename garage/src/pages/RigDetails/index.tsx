import React, { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Spinner,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { TablelandConnectButton } from "../../components/TablelandConnectButton";
import { TrainRigModal, ParkRigModal } from "../../components/FlyParkModals";
import { useOwnedRigs } from "../../hooks/useOwnedRigs";
import { useRig } from "../../hooks/useRig";
import { useNFTs } from "../../hooks/useNFTs";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigDisplay } from "../../components/RigDisplay";
import { FlightLog } from "./modules/FlightLog";
import { Pilots } from "./modules/Pilots";
import { Badges } from "./modules/Badges";
import { RigAttributes } from "./modules/RigAttributes";
import { findNFT } from "../../utils/nfts";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

export const RigDetails = () => {
  const { id } = useParams();
  const { rig, refresh } = useRig(id || "");
  const { rigs } = useOwnedRigs();
  const pilots = useMemo(() => {
    return rig?.pilotSessions.filter((v) => v.contract);
  }, [rig]);
  const { nfts } = useNFTs(pilots);

  const userOwnsRig = useMemo(() => {
    return !!(rigs && rig && rigs.map((v) => v.id).includes(rig.id));
  }, [rig, rigs]);

  const currentNFT =
    rig?.currentPilot && nfts && findNFT(rig.currentPilot, nfts);

  // NOTE(daniel): refresh callbacks use a 2s delay because we read the status from Tableland
  // and not the contract and there is a small delay between a transaction finishing and
  // the data being queryable

  const {
    isOpen: trainModalOpen,
    onOpen: onOpenTrainModal,
    onClose: _onCloseTrainModal,
  } = useDisclosure();

  const onCloseTrainModal = useCallback(
    (completedTx: boolean) => {
      _onCloseTrainModal();
      if (completedTx) setTimeout(() => refresh(), 2_000);
    },
    [_onCloseTrainModal, refresh]
  );

  const {
    isOpen: parkModalOpen,
    onOpen: onOpenParkModal,
    onClose: _onCloseParkModal,
  } = useDisclosure();

  const onCloseParkModal = useCallback(
    (completedTx: boolean) => {
      _onCloseParkModal();
      if (completedTx) setTimeout(() => refresh(), 2_000);
    },
    [_onCloseParkModal, refresh]
  );

  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
    >
      <Grid
        templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(2, 1fr)" }}
        p={GRID_GAP}
        gap={GRID_GAP}
        maxWidth="1385px"
        height="100%"
      >
        {rig && nfts && (
          <>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Box p={4} bgColor="paper" borderRadius="3px">
                  <RigDisplay
                    border={1}
                    borderStyle="solid"
                    borderColor="black"
                    borderRadius="3px"
                    rig={rig}
                    pilotNFT={currentNFT}
                    pilotBorderWidth="3px"
                  />
                </Box>
                <RigAttributes rig={rig} {...MODULE_PROPS} />
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Pilots
                  rig={rig}
                  nfts={nfts}
                  isOwner={userOwnsRig}
                  onOpenParkModal={onOpenParkModal}
                  onOpenTrainModal={onOpenTrainModal}
                  {...MODULE_PROPS}
                />
                <Badges rig={rig} nfts={nfts} {...MODULE_PROPS} />
                <FlightLog rig={rig} nfts={nfts} {...MODULE_PROPS} />
              </VStack>
            </GridItem>
          </>
        )}

        {!rig && <Spinner />}
      </Grid>
      {rig && trainModalOpen && (
        <TrainRigModal
          rig={rig}
          isOpen={trainModalOpen}
          onClose={onCloseTrainModal}
        />
      )}
      {rig && parkModalOpen && (
        <ParkRigModal
          rig={rig}
          isOpen={parkModalOpen}
          onClose={onCloseParkModal}
        />
      )}
    </Flex>
  );
};
