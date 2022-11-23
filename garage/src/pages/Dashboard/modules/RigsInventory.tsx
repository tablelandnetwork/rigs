import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { CheckIcon } from "@chakra-ui/icons";
import { useOwnedRigs } from "../../../hooks/useOwnedRigs";
import { useTablelandConnection } from "../../../hooks/useTablelandConnection";
import { useNFTs, NFT } from "../../../hooks/useNFTs";
import { Rig, Pilot } from "../../../types";
import { RigDisplay } from "../../../components/RigDisplay";
import { useGlobalFlyParkModals } from "../../../components/GlobalFlyParkModals";
import { ChainAwareButton } from "../../../components/ChainAwareButton";
import { findNFT } from "../../../utils/nfts";
import { sleep, runUntilConditionMet } from "../../../utils/async";

interface RigListItemProps {
  rig: Rig;
  nfts: NFT[];
  loading: boolean;
  selected: boolean;
  selectable: boolean;
  toggleSelected: () => void;
}

const RigListItem = ({
  rig,
  nfts,
  loading,
  selected,
  selectable,
  toggleSelected,
}: RigListItemProps) => {
  const currentNFT = rig.currentPilot && findNFT(rig.currentPilot, nfts);

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
        <Flex width="100%" justify="space-between">
          <Text>{`#${rig.id}`}</Text>
          <Text>{rig.currentPilot && "In-flight"}</Text>
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
  IN_FLIGHT,
  PARKED,
}

const firstSetValue = <T,>(s: Set<T>) => {
  if (s.size) return s.values().next().value;
};

const copySet = <T,>(s: Set<T>): Set<T> => {
  return new Set(Array.from(s));
};

const toggleInSet = <T,>(s: Set<T>, v: T) => {
  if (s.has(v)) {
    s.delete(v);
  } else {
    s.add(v);
  }

  return s;
};

export const RigsInventory = (props: React.ComponentProps<typeof Box>) => {
  const { rigs, refresh } = useOwnedRigs();
  const { connection: tableland } = useTablelandConnection();
  const pilots = useMemo(() => {
    if (!rigs) return;

    return rigs
      .map((v) => v.currentPilot)
      .filter((v) => v?.contract) as Pilot[];
  }, [rigs]);
  const { nfts } = useNFTs(pilots);

  const [selectedRigs, setSelectedRigs] = useState<Set<string>>(new Set());

  const currentlySelectable = useMemo(() => {
    const selectedRig = rigs?.find((v) => v.id === firstSetValue(selectedRigs));

    return selectedRig
      ? selectedRig.currentPilot
        ? Selectable.IN_FLIGHT
        : Selectable.PARKED
      : Selectable.ALL;
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

  // Effect that waits until a tableland receipt is available for a tx hash
  // and then refreshes the rig data
  useEffect(() => {
    if (tableland && pendingTx) {
      runUntilConditionMet(
        () => tableland.receipt(pendingTx),
        (data) => !!data,
        refreshRigsAndClearPendingTx,
        {
          initialDelay: 5_000,
          wait: 2_000,
          maxNumberOfAttempts: 10,
          onMaxNumberOfAttemptsReached: clearPendingTx,
        }
      );
    }
  }, [pendingTx, refreshRigsAndClearPendingTx, tableland, clearPendingTx]);

  const { trainRigsModal, parkRigsModal } = useGlobalFlyParkModals();

  const openTrainModal = useCallback(() => {
    if (rigs?.length && selectedRigs.size) {
      const modalRigs = rigs.filter((v) => selectedRigs.has(v.id));
      trainRigsModal.openModal(modalRigs, setPendingTx);
    }
  }, [rigs, trainRigsModal, selectedRigs, setPendingTx]);

  const openParkModal = useCallback(() => {
    if (rigs?.length && selectedRigs.size) {
      const modalRigs = rigs.filter((v) => selectedRigs.has(v.id));
      parkRigsModal.openModal(modalRigs, setPendingTx);
    }
  }, [rigs, parkRigsModal, selectedRigs, setPendingTx]);

  return (
    <VStack align="start" {...props} sx={{ height: "100%", width: "100%" }}>
      <Heading mb={2}>Rigs {rigs && ` (${rigs.length})`}</Heading>

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
            const selected = selectedRigs.has(rig.id);
            const hasPilot = !!rig.currentPilot;
            const selectable =
              currentlySelectable === Selectable.ALL ||
              (currentlySelectable === Selectable.IN_FLIGHT && hasPilot) ||
              (currentlySelectable === Selectable.PARKED && !hasPilot);
            return (
              <RigListItem
                rig={rig}
                key={`rig-${index}`}
                nfts={nfts}
                loading={selected && !!pendingTx}
                selected={selected}
                selectable={!pendingTx && selectable}
                toggleSelected={() => toggleRigSelected(rig)}
              />
            );
          })}
        </Grid>
      )}

      <Flex justify="flex-end" width="100%" pt={6}>
        <ChainAwareButton
          disabled={!!pendingTx || !selectedRigs.size}
          onClick={
            currentlySelectable === Selectable.PARKED
              ? openTrainModal
              : openParkModal
          }
        >
          {selectedRigs.size === 0
            ? "Select Rigs"
            : currentlySelectable === Selectable.PARKED
            ? "Train selected"
            : "Park selected"}
        </ChainAwareButton>
      </Flex>

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
