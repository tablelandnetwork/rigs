import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { TrainRigModal, ParkRigModal } from "../../components/FlyParkModals";
import { useOwnedRigs } from "../../hooks/useOwnedRigs";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { useRig } from "../../hooks/useRig";
import { useNFTs } from "../../hooks/useNFTs";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigDisplay } from "../../components/RigDisplay";
import { FlightLog } from "./modules/FlightLog";
import { Pilots } from "./modules/Pilots";
import { RigAttributes } from "./modules/RigAttributes";
import { findNFT } from "../../utils/nfts";
import { sleep, runUntilConditionMet } from "../../utils/async";

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
  const { connection: tableland } = useTablelandConnection();
  const { rigs } = useOwnedRigs();
  const pilots = useMemo(() => {
    return rig?.pilotSessions.filter((v) => v.contract);
  }, [rig]);
  const { nfts } = useNFTs(pilots);

  const userOwnsRig = useMemo(() => {
    return !!(rigs && rig && rigs.map((v) => v.id).includes(rig.id));
  }, [rig, rigs]);

  const [pendingTx, setPendingTx] = useState<string>();
  const clearPendingTx = useCallback(() => {
    setPendingTx(undefined);
  }, [setPendingTx]);

  const refreshRigAndClearPendingTx = useCallback(() => {
    refresh();
    sleep(500).then(_ => setPendingTx(undefined));
  }, [refresh, setPendingTx]);

  // Effect that waits until a tableland receipt is available for a tx hash
  // and then refreshes the rig data
  useEffect(() => {
    if (tableland && pendingTx) {
      runUntilConditionMet(
        () => tableland.receipt(pendingTx),
        (data) => !!data,
        refreshRigAndClearPendingTx,
        {
          initialDelay: 0,
          wait: 2_000,
          maxNumberOfAttempts: 10,
          onMaxNumberOfAttemptsReached: clearPendingTx,
        }
      );
    }
  }, [pendingTx, refreshRigAndClearPendingTx, tableland, clearPendingTx]);

  const currentNFT =
    rig?.currentPilot && nfts && findNFT(rig.currentPilot, nfts);

  const {
    isOpen: trainModalOpen,
    onOpen: onOpenTrainModal,
    onClose: onCloseTrainModal,
  } = useDisclosure();

  const {
    isOpen: parkModalOpen,
    onOpen: onOpenParkModal,
    onClose: onCloseParkModal,
  } = useDisclosure();

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
                    loading={!!pendingTx}
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
                <FlightLog rig={rig} nfts={nfts} {...MODULE_PROPS} />
              </VStack>
            </GridItem>
          </>
        )}

        {!rig && <Spinner />}
      </Grid>
      {rig && trainModalOpen && (
        <TrainRigModal
          rigs={[rig]}
          isOpen={trainModalOpen}
          onClose={onCloseTrainModal}
          onTransactionSubmitted={setPendingTx}
        />
      )}
      {rig && parkModalOpen && (
        <ParkRigModal
          rigs={[rig]}
          isOpen={parkModalOpen}
          onClose={onCloseParkModal}
          onTransactionSubmitted={setPendingTx}
        />
      )}
    </Flex>
  );
};
