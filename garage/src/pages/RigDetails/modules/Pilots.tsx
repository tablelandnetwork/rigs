import React from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Image,
  StackItem,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { RigWithPilots, PilotSession } from "../../../types";
import { TrainerPilot } from "../../../components/TrainerPilot";
import { useBlockNumber } from "wagmi";
import { NFT } from "../../../hooks/useNFTs";
import { findNFT } from "../../../utils/nfts";
import { prettyNumber } from "../../../utils/fmt";

const getPilots = (
  rig: RigWithPilots,
  nfts: NFT[],
  blockNumber: number | undefined
) => {
  const accumulator: { [key: string]: PilotSession[] } = {};

  const pilots = rig.pilotSessions.reduce((acc, session) => {
    const key = session.contract + session.tokenId;
    (acc[key] = acc[key] || []).push(session);
    return acc;
  }, accumulator);

  return Object.values(pilots).map((sessions) => {
    const status = sessions.find((v) => !v.endTime) ? "Active" : "Garaged";

    const nft = findNFT(sessions[0], nfts);
    const { name = "Trainer", imageUrl = "" } = nft || {};

    const flightTime = sessions.reduce((acc, { startTime, endTime }) => {
      return acc + ((endTime ?? blockNumber ?? startTime) - startTime);
    }, 0);

    return {
      flightTime,
      status,
      imageUrl: imageUrl,
      pilot: name || "Trainer",
    };
  });
};

type PilotProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  nfts: NFT[];
  isOwner: boolean;
  onOpenTrainModal: () => void;
  onOpenParkModal: () => void;
};

export const Pilots = ({
  rig,
  nfts,
  isOwner,
  onOpenTrainModal,
  onOpenParkModal,
  p,
  ...props
}: PilotProps) => {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const pilots = getPilots(rig, nfts, blockNumber);

  const totalFlightTime = pilots.reduce(
    (acc, { flightTime }) => acc + flightTime,
    0
  );

  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <HStack
        px={p}
        justify="space-between"
        align="baseline"
        sx={{ width: "100%" }}
      >
        <Heading size="xl">Rig {`#${rig.id}`}</Heading>
        <Heading size="sm">
          {rig.currentPilot ? "In-flight" : "Parked"}
          {` (${prettyNumber(totalFlightTime)} FT)`}
        </Heading>
      </HStack>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} colSpan={2}>
              Pilot
            </Th>
            <Th>Flight time (FT)</Th>
            <Th pr={p}>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {pilots.map(({ pilot, imageUrl, flightTime, status }, index) => {
            return (
              <Tr key={`pilots-${index}`}>
                <Td
                  pl={p}
                  pr={0}
                  width={`calc(var(--chakra-sizes-${p}) + 30px)`}
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      width="30px"
                      height="30px"
                      backgroundColor="primary"
                    />
                  ) : (
                    <TrainerPilot width="30px" height="30px" />
                  )}
                </Td>
                <Td pl={3}>{pilot}</Td>
                <Td>{prettyNumber(flightTime)}</Td>
                <Td pr={p} color={status == "Garaged" ? "inactive" : "inherit"}>
                  {status}
                </Td>
              </Tr>
            );
          })}
          {pilots.length === 0 && (
            <Text px={p} py={4} variant="emptyState">
              This Rig has never left the garage.
            </Text>
          )}
        </Tbody>
      </Table>
      {isOwner && (
        <StackItem px={4} pb={4}>
          {!rig.currentPilot && (
            <Button variant="outlined" onClick={onOpenTrainModal} width="100%">
              Train
            </Button>
          )}
          {rig.currentPilot && (
            <Button variant="outlined" onClick={onOpenParkModal} width="100%">
              Park
            </Button>
          )}
        </StackItem>
      )}
    </VStack>
  );
};
