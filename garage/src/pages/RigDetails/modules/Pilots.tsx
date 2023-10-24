import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Flex,
  Heading,
  HStack,
  Image,
  Show,
  StackItem,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { QuestionIcon } from "@chakra-ui/icons";
import { RigWithPilots, PilotSession } from "../../../types";
import { TrainerPilot } from "../../../components/TrainerPilot";
import { ChainAwareButton } from "../../../components/ChainAwareButton";
import { AboutPilotsModal } from "../../../components/AboutPilotsModal";
import { useBlockNumber } from "wagmi";
import { NFT } from "../../../hooks/useNFTs";
import { findNFT } from "../../../utils/nfts";
import { prettyNumber, pluralize } from "../../../utils/fmt";
import { mainChain, deployment } from "../../../env";

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
    const { tokenId, contract } = sessions[0];
    const status = sessions.find((v) => !v.endTime) ? "Active" : "Garaged";

    const nft = findNFT(sessions[0], nfts);
    const { name = "Trainer", imageUrl = "" } = nft || {};

    const flightTime = sessions.reduce((acc, { startTime, endTime }) => {
      return (
        acc + Math.max((endTime ?? blockNumber ?? startTime) - startTime, 0)
      );
    }, 0);

    return {
      flightTime,
      status,
      sessions,
      imageUrl: imageUrl,
      pilot: name || "Trainer",
      contract,
      tokenId,
    };
  });
};

type PilotProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  nfts: NFT[];
  isOwner: boolean;
  chainPilotStatus?: number;
  onOpenTrainModal: () => void;
  onOpenPilotModal: () => void;
  onOpenParkModal: () => void;
};

export const Pilots = ({
  rig,
  nfts,
  isOwner,
  chainPilotStatus,
  onOpenTrainModal,
  onOpenPilotModal,
  onOpenParkModal,
  p,
  ...props
}: PilotProps) => {
  const { data: blockNumber, refetch } = useBlockNumber();
  useEffect(() => {
    refetch();
  }, [rig, refetch]);
  const pilots = getPilots(rig, nfts, Number(blockNumber));

  const {
    isOpen: isInfoOpen,
    onClose: onCloseInfo,
    onOpen: onOpenInfo,
  } = useDisclosure();

  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Pilots</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} colSpan={2}>
              Pilot
            </Th>
            <Show above="xl">
              <Th isNumeric>Sessions</Th>
            </Show>
            <Th isNumeric>
              <Show above="sm">Flight time (FT)</Show>
              <Show below="sm">FT</Show>
            </Th>
            <Th pr={p}>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {pilots.map(
            (
              {
                pilot,
                sessions,
                imageUrl,
                flightTime,
                status,
                contract,
                tokenId,
              },
              index
            ) => {
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
                  <Td pl={3} wordBreak="break-all">
                    {contract && tokenId ? (
                      <Link to={`/pilots/${contract}/${tokenId}`}>{pilot}</Link>
                    ) : (
                      pilot
                    )}
                  </Td>
                  <Show above="xl">
                    <Td isNumeric>{sessions.length}</Td>
                  </Show>
                  <Td isNumeric sx={{ whiteSpace: "nowrap" }}>
                    {prettyNumber(flightTime)}
                    <Show below="xl">
                      <wbr />
                      <Text fontSize="xs">
                        (
                        {`${sessions.length} ${pluralize("session", sessions)}`}
                        )
                      </Text>
                    </Show>
                  </Td>
                  <Td
                    pr={p}
                    color={status == "Garaged" ? "inactive" : "inherit"}
                  >
                    {status}
                  </Td>
                </Tr>
              );
            }
          )}
        </Tbody>
      </Table>
      {pilots.length === 0 && (
        <Text px={p} py={4} variant="emptyState">
          This Rig has never left the garage.
        </Text>
      )}
      {isOwner && (
        <StackItem px={4}>
          <HStack gap={3}>
            {!rig.currentPilot && !rig.isTrained && chainPilotStatus !== 2 && (
              <ChainAwareButton
                expectedChain={mainChain}
                variant="outlined"
                onClick={onOpenTrainModal}
                width="100%"
              >
                Train
              </ChainAwareButton>
            )}
            {(rig.isTrained || rig.currentPilot || chainPilotStatus === 2) && (
              <ChainAwareButton
                expectedChain={mainChain}
                variant="outlined"
                isDisabled={
                  !!rig.currentPilot?.contract ||
                  (!rig.isTrained && chainPilotStatus !== 2)
                }
                onClick={onOpenPilotModal}
                width="100%"
              >
                Pilot
              </ChainAwareButton>
            )}
            {rig.currentPilot && (
              <ChainAwareButton
                expectedChain={mainChain}
                variant="outlined"
                onClick={onOpenParkModal}
                width="100%"
              >
                Park
              </ChainAwareButton>
            )}
          </HStack>
        </StackItem>
      )}
      <StackItem pb={2}>
        <Flex justify="center">
          <Text
            onClick={onOpenInfo}
            sx={{ _hover: { textDecoration: "underline", cursor: "pointer" } }}
          >
            <QuestionIcon mr={2} />
            Learn more about Rig pilots
          </Text>
        </Flex>
      </StackItem>
      <AboutPilotsModal isOpen={isInfoOpen} onClose={onCloseInfo} />
    </VStack>
  );
};
