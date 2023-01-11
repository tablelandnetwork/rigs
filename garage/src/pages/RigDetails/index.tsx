import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Link,
  Show,
  Spinner,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { ArrowForwardIcon } from "@chakra-ui/icons";
import { useParams, Link as RouterLink } from "react-router-dom";
import { useAccount, useBlockNumber } from "wagmi";
import { useGlobalFlyParkModals } from "../../components/GlobalFlyParkModals";
import { ChainAwareButton } from "../../components/ChainAwareButton";
import { TransferRigModal } from "../../components/TransferRigModal";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { useRig } from "../../hooks/useRig";
import { useNFTs, useNFTOwner } from "../../hooks/useNFTs";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigDisplay } from "../../components/RigDisplay";
import { FlightLog } from "./modules/FlightLog";
import { Pilots } from "./modules/Pilots";
import { RigAttributes } from "./modules/RigAttributes";
import { findNFT } from "../../utils/nfts";
import { prettyNumber } from "../../utils/fmt";
import { sleep, runUntilConditionMet } from "../../utils/async";
import { contractAddress } from "../../contract";
import { openseaBaseUrl } from "../../env";
import { RigWithPilots } from "../../types";
import openseaMark from "../../assets/opensea-mark.svg";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

type RigHeaderProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  owner?: string;
  userOwnsRig?: boolean;
  currentBlockNumber?: number;
  refresh: () => void;
};

const RigHeader = ({
  rig,
  owner,
  userOwnsRig,
  currentBlockNumber,
  refresh,
  ...props
}: RigHeaderProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const totalFlightTime = rig.pilotSessions.reduce(
    (acc, { startTime, endTime }) => {
      return (
        acc +
        Math.max((endTime ?? currentBlockNumber ?? startTime) - startTime, 0)
      );
    },
    0
  );

  return (
    <>
      <TransferRigModal
        rig={rig}
        isOpen={isOpen}
        onClose={onClose}
        onTransactionCompleted={refresh}
      />
      <Box {...props}>
        <HStack justify="space-between" align="baseline" sx={{ width: "100%" }}>
          <Heading size="xl">Rig {`#${rig.id}`}</Heading>

          <HStack>
            <Link
              href={`${openseaBaseUrl}/${contractAddress}/${rig.id}`}
              title={`View Rig #${rig.id} on OpenSea`}
              isExternal
            >
              <Image src={openseaMark} />
            </Link>
          </HStack>
        </HStack>
        <Heading size="sm">
          {rig.currentPilot ? "In-flight" : "Parked"}
          {` (${prettyNumber(totalFlightTime)} FT)`}
        </Heading>
        <HStack pt={8} justify="space-between">
          <Text>
            Owned by{" "}
            <RouterLink to={`/owner/${owner}`} style={{ fontWeight: "bold" }}>
              {userOwnsRig ? "You" : owner}
            </RouterLink>
          </Text>

          {userOwnsRig && (
            <ChainAwareButton
              variant="solid"
              color="primary"
              size="sm"
              onClick={onOpen}
              leftIcon={<ArrowForwardIcon />}
            >
              Transfer
            </ChainAwareButton>
          )}
        </HStack>
      </Box>
    </>
  );
};

export const RigDetails = () => {
  const { id } = useParams();
  const { address } = useAccount();
  const { data: currentBlockNumber } = useBlockNumber();
  const { rig, refresh: refreshRig } = useRig(id || "", currentBlockNumber);
  const { connection: tableland } = useTablelandConnection();
  const { owner, refresh: refreshOwner } = useNFTOwner(contractAddress, id);
  const pilots = useMemo(() => {
    return rig?.pilotSessions.filter((v) => v.contract);
  }, [rig]);
  const { nfts } = useNFTs(pilots);

  const refresh = useCallback(() => {
    refreshRig();
    refreshOwner();
  }, [useRig, useMemo]);

  const userOwnsRig = useMemo(() => {
    return !!address && address.toLowerCase() === owner?.toLowerCase();
  }, [address, owner]);

  const [pendingTx, setPendingTx] = useState<string>();
  const clearPendingTx = useCallback(() => {
    setPendingTx(undefined);
  }, [setPendingTx]);

  const refreshRigAndClearPendingTx = useCallback(() => {
    refresh();
    sleep(500).then((_) => setPendingTx(undefined));
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
          initialDelay: 5_000,
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
    trainRigsModal,
    pilotRigsModal,
    parkRigsModal,
  } = useGlobalFlyParkModals();

  const onOpenTrainModal = useCallback(() => {
    if (rig) trainRigsModal.openModal([rig], setPendingTx);
  }, [rig, setPendingTx]);

  const onOpenPilotModal = useCallback(() => {
    if (rig) pilotRigsModal.openModal([rig], setPendingTx);
  }, [rig, setPendingTx]);

  const onOpenParkModal = useCallback(() => {
    if (rig) parkRigsModal.openModal([rig], setPendingTx);
  }, [rig, setPendingTx]);

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
                <Show below="md">
                  <RigHeader
                    {...MODULE_PROPS}
                    rig={rig}
                    owner={owner}
                    userOwnsRig={userOwnsRig}
                    currentBlockNumber={currentBlockNumber}
                    refresh={refresh}
                  />
                </Show>
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
                <Show above="md">
                  <RigHeader
                    {...MODULE_PROPS}
                    rig={rig}
                    owner={owner}
                    userOwnsRig={userOwnsRig}
                    currentBlockNumber={currentBlockNumber}
                    refresh={refresh}
                  />
                </Show>
                <Pilots
                  rig={rig}
                  nfts={nfts}
                  isOwner={userOwnsRig}
                  onOpenParkModal={onOpenParkModal}
                  onOpenPilotModal={onOpenPilotModal}
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
    </Flex>
  );
};
