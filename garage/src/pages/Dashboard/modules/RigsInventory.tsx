import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  Hide,
  Grid,
  GridItem,
  Show,
  Spacer,
  Spinner,
  Stack,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { CheckIcon, QuestionIcon } from "@chakra-ui/icons";
import { useBlockNumber } from "wagmi";
import { useAccount } from "~/hooks/useAccount";
import { useOwnedRigs } from "~/hooks/useOwnedRigs";
import { NFT } from "~/hooks/useNFTs";
import { useNFTsCached } from "~/components/NFTsContext";
import { Rig, RigWithPilots, Pilot } from "~/types";
import { RigDisplay } from "~/components/RigDisplay";
import { useGlobalFlyParkModals } from "~/components/GlobalFlyParkModals";
import { TablelandConnectButton } from "~/components/TablelandConnectButton";
import { ChainAwareButton } from "~/components/ChainAwareButton";
import { AboutPilotsModal } from "~/components/AboutPilotsModal";
import { findNFT } from "~/utils/nfts";
import { sleep } from "~/utils/async";
import { prettyNumber } from "~/utils/fmt";
import { firstSetValue, copySet, toggleInSet } from "~/utils/set";
import { mainChain } from "~/env";
import { useWaitForTablelandTxn } from "~/hooks/useWaitForTablelandTxn";

interface RigListItemProps {
  rig: RigWithPilots;
  nfts: NFT[];
  loading: boolean;
  selected: boolean;
  selectable: boolean;
  toggleSelected: () => void;
  currentBlockNumber?: number;
}

const RigListItem = ({
  rig,
  nfts,
  loading,
  selected,
  selectable,
  toggleSelected,
  currentBlockNumber,
}: RigListItemProps) => {
  const currentNFT = rig.currentPilot && findNFT(rig.currentPilot, nfts);

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
    <GridItem>
      <VStack align="start" pb={2} flexShrink="0">
        <Link
          to={`/rigs/${rig.id}`}
          style={{ position: "relative", display: "block" }}
        >
          <RigDisplay
            outlineColor="primary"
            outline={selected ? "2px solid" : undefined}
            rig={rig}
            borderRadius="3px"
            pilotNFT={currentNFT}
            loading={loading}
          />
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            bottom="0"
            _hover={{ backgroundColor: "rgba(0,0,0,0.15)" }}
            transition=".2s"
          />
        </Link>
        <Flex width="100%" justify="space-between" align="center">
          <Flex>
            <Text>Rig {`#${rig.id}`}</Text>
            <Text marginTop="2px" marginLeft="4px">
              {rig.currentPilot && "✈️"}
            </Text>
          </Flex>
          <Text fontSize="sm">{prettyNumber(totalFlightTime)} FT</Text>
        </Flex>
        <Button
          variant="outlined-background"
          isDisabled={!selectable}
          onClick={toggleSelected}
          sx={{ width: "100%" }}
          leftIcon={selected ? <CheckIcon /> : undefined}
        >
          {selectable ? (selected ? "Selected" : "Select") : "Not available"}
        </Button>
      </VStack>
    </GridItem>
  );
};

enum Selectable {
  ALL,
  PARKABLE,
  PILOTABLE,
  TRAINABLE,
}

const isSelectable = (rig: Rig, selectable: Selectable): boolean => {
  const { isTrained, currentPilot } = rig;
  const canPark = !!currentPilot;
  const canTrain = !isTrained && !currentPilot;
  const canPilot = isTrained && !currentPilot?.contract;

  switch (selectable) {
    case Selectable.TRAINABLE:
      return canTrain;
    case Selectable.PARKABLE:
      return canPark;
    case Selectable.PILOTABLE:
      return canPilot;
    case Selectable.ALL:
      return true;
  }
};

export const RigsInventory = (props: React.ComponentProps<typeof Box>) => {
  const { actingAsAddress } = useAccount();
  const { rigs, refresh } = useOwnedRigs(actingAsAddress);
  const { data: currentBlockNumber } = useBlockNumber();
  const pilots = useMemo(() => {
    if (!rigs) return;

    return rigs
      .map((v) => v.currentPilot)
      .filter((v) => v?.contract) as Pilot[];
  }, [rigs]);
  const { nfts } = useNFTsCached(pilots);

  const [selectedRigs, setSelectedRigs] = useState<Set<string>>(new Set());

  const currentlySelectable = useMemo(() => {
    const selectedRig = rigs?.find((v) => v.id === firstSetValue(selectedRigs));
    if (!selectedRig) return Selectable.ALL;

    const { isTrained, currentPilot } = selectedRig;
    const isPiloted = !!currentPilot?.contract;

    if (isTrained) {
      return isPiloted ? Selectable.PARKABLE : Selectable.PILOTABLE;
    }

    return currentPilot ? Selectable.PARKABLE : Selectable.TRAINABLE;
  }, [selectedRigs]);

  const toggleRigSelected = useCallback(
    (rig: Rig) => {
      setSelectedRigs((old) => toggleInSet(copySet(old), rig.id));
    },
    [setSelectedRigs]
  );

  const [pendingTx, setPendingTx] = useState<string>();
  const clearPendingTx = useCallback(() => {
    setPendingTx(undefined);
  }, [setPendingTx]);

  const refreshRigsAndClearPendingTx = useCallback(() => {
    refresh();
    sleep(500).then((_) => setPendingTx(undefined));
  }, [refresh, setPendingTx, setSelectedRigs]);

  useEffect(() => {
    if (!pendingTx) setSelectedRigs(new Set());
  }, [pendingTx]);

  useWaitForTablelandTxn(
    mainChain.id,
    pendingTx,
    refreshRigsAndClearPendingTx,
    clearPendingTx
  );

  const { trainRigsModal, pilotRigsModal, parkRigsModal } =
    useGlobalFlyParkModals();

  const openTrainModal = useCallback(() => {
    if (rigs?.length && selectedRigs.size) {
      const modalRigs = rigs.filter((v) => selectedRigs.has(v.id));
      trainRigsModal.openModal(modalRigs, setPendingTx);
    }
  }, [rigs, trainRigsModal, selectedRigs, setPendingTx]);

  const openPilotModal = useCallback(() => {
    if (rigs?.length && selectedRigs.size) {
      const modalRigs = rigs.filter((v) => selectedRigs.has(v.id));
      pilotRigsModal.openModal(modalRigs, setPendingTx);
    }
  }, [rigs, pilotRigsModal, selectedRigs, setPendingTx]);

  const openParkModal = useCallback(() => {
    if (rigs?.length && selectedRigs.size) {
      const modalRigs = rigs.filter((v) => selectedRigs.has(v.id));
      parkRigsModal.openModal(modalRigs, setPendingTx);
    }
  }, [rigs, parkRigsModal, selectedRigs, setPendingTx]);

  const {
    isOpen: isInfoOpen,
    onClose: onCloseInfo,
    onOpen: onOpenInfo,
  } = useDisclosure();

  return (
    <VStack align="start" {...props} sx={{ height: "100%", width: "100%" }}>
      <Flex
        direction={{ base: "column", sm: "row" }}
        align={{ base: "start", sm: "center" }}
        justify="space-between"
        width="100%"
      >
        <Heading mb={2}>Rigs {rigs && ` (${rigs.length})`}</Heading>
        <Text
          onClick={onOpenInfo}
          sx={{ _hover: { textDecoration: "underline", cursor: "pointer" } }}
          mb={{ base: 6, sm: 0 }}
        >
          <QuestionIcon mr={2} />
          Learn more about Rig pilots
        </Text>
      </Flex>
      {rigs && nfts && (
        <Grid
          gap={4}
          templateColumns={{
            base: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            xl: "repeat(4, 1fr)",
          }}
        >
          {rigs.map((rig, index) => {
            const selected = selectedRigs.has(rig.id);
            const selectable = isSelectable(rig, currentlySelectable);
            return (
              <RigListItem
                rig={rig}
                key={`rig-${index}`}
                nfts={nfts}
                loading={selected && !!pendingTx}
                selected={selected}
                selectable={!pendingTx && selectable}
                toggleSelected={() => toggleRigSelected(rig)}
                currentBlockNumber={Number(currentBlockNumber)}
              />
            );
          })}
        </Grid>
      )}

      {rigs && rigs.length === 0 && (
        <Flex
          width="100%"
          height="200px"
          align="center"
          justify="center"
          direction="column"
        >
          <Text variant="emptyState" pt={8} pb={4}>
            You don't own any Rigs.
          </Text>
          <Button as={Link} to="/gallery" height="40px">
            Browse Rigs gallery
          </Button>
        </Flex>
      )}

      {!rigs && actingAsAddress && (
        <Flex width="100%" height="200px" align="center" justify="center">
          <Spinner />
        </Flex>
      )}

      {!actingAsAddress && (
        <Flex
          width="100%"
          height="200px"
          align="center"
          justify="center"
          direction="column"
        >
          <Text variant="emptyState">No wallet connected.</Text>
          <Stack pt={8} direction={{ base: "column", sm: "row" }}>
            <TablelandConnectButton size="small" />
            <Spacer width={3} />
            <Show below="sm">
              <Divider orientation="horizontal" />
            </Show>
            <Hide below="sm">
              <Divider orientation="vertical" />
            </Hide>
            <Spacer width={3} />
            <Button
              as={Link}
              to="/gallery"
              height={{ base: "40px", sm: "100%" }}
            >
              Browse Rigs gallery
            </Button>
          </Stack>
        </Flex>
      )}

      {rigs?.length && (
        <Flex justify="flex-end" width="100%" pt={6}>
          <ChainAwareButton
            disabled={!!pendingTx || !selectedRigs.size}
            onClick={
              currentlySelectable === Selectable.PARKABLE
                ? openParkModal
                : currentlySelectable === Selectable.PILOTABLE
                ? openPilotModal
                : openTrainModal
            }
          >
            {selectedRigs.size === 0
              ? "Select Rigs"
              : currentlySelectable === Selectable.PILOTABLE
              ? "Pilot selected"
              : currentlySelectable === Selectable.TRAINABLE
              ? "Train selected"
              : "Park selected"}
          </ChainAwareButton>
        </Flex>
      )}

      <AboutPilotsModal isOpen={isInfoOpen} onClose={onCloseInfo} />
    </VStack>
  );
};
