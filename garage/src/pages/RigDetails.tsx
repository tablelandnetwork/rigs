import React from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Spinner,
  StackItem,
  Table,
  Tbody,
  Text,
  Thead,
  Td,
  Th,
  Tr,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { RigWithPilots, PilotSession } from "../types";
import { Topbar } from "../Topbar";
import { TrainerPilot } from "../components/TrainerPilot";
import { RigDisplay } from "../components/RigDisplay";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useBlockNumber,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import { useRig } from "../hooks/useRig";
import { useNFTs, NFT } from "../hooks/useNFTs";
import { findNFT } from "../utils/nfts";
import { CONTRACT_ADDRESS, CONTRACT_INTERFACE } from "../settings";
import { prettyNumber } from "../utils/fmt";
import { education, code } from "../assets/badges/";

const GRID_GAP = 4;
const PAPER_TABLE_PT = 8;
const PAPER_TABLE_HEADING_PX = 8;

interface RigModuleProps {
  rig: RigWithPilots;
  nfts: NFT[];
}

const RigAttributes = ({ rig }: RigModuleProps) => {
  if (!rig.attributes) return null;

  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Properties</Heading>
      <Table variant="simple">
        <Tbody>
          {rig.attributes
            .filter(({ traitType }) => traitType !== "VIN")
            .map((attribute, index) => {
              const tdProps =
                index === rig.attributes!.length - 1
                  ? { borderBottom: "none" }
                  : index === 0
                  ? { borderTop: "var(--chakra-borders-1px)" }
                  : {};
              return (
                <Tr key={`rig-${rig.id}-attribute-${attribute.traitType}`}>
                  <Td pl={8} {...tdProps}>
                    {attribute.traitType}
                  </Td>
                  <Td pr={8} {...tdProps} textAlign="right">
                    {attribute.value}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
    </VStack>
  );
};

interface ModalProps {
  rig: RigWithPilots;
  isOpen: boolean;
  onClose: () => void;
}

const TrainRigModal = ({ rig, isOpen, onClose }: ModalProps) => {
  const { config } = usePrepareContractWrite({
    addressOrName: CONTRACT_ADDRESS,
    contractInterface: CONTRACT_INTERFACE,
    functionName: "trainRig",
    args: ethers.BigNumber.from(rig.id),
  });

  const {
    data,
    isLoading,
    isSuccess,
    isError,
    error,
    write,
  } = useContractWrite(config);

  // TODO include information about the tx like the hash in loading & success messages
  // TODO show better error messages
  // TODO prevent the user from closing the modal while the tx is loading?
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Train Rig</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            Before your Rig can handle any pilot it needs to go through training
            for 30 days with the training pilot.
          </Text>
          <Text mt={4} sx={{ fontStyle: "italic" }}>
            Training your rig requires an on-chain transaction. When you click
            the Train button below your wallet will request that you sign a
            transaction that will cost a small gas fee.
          </Text>
          {isLoading && <Spinner />}
          {isSuccess && "You did it!"}
          {isError && "Uh oh, got an error"}
        </ModalBody>
        <ModalFooter>
          <Button
            colorScheme="blue"
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Train rig
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const ParkRigModal = ({ rig, isOpen, onClose }: ModalProps) => {
  const { config } = usePrepareContractWrite({
    addressOrName: CONTRACT_ADDRESS,
    contractInterface: CONTRACT_INTERFACE,
    functionName: "parkRig",
    args: ethers.BigNumber.from(rig.id),
  });

  const {
    data,
    isLoading,
    isSuccess,
    isError,
    error,
    write,
  } = useContractWrite(config);

  // TODO include information about the tx like the hash in loading & success messages
  // TODO show better error messages
  // TODO prevent the user from closing the modal while the tx is loading?
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Park Rig</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          Parking your rig will let you do things like change pilot, chosing
          what badges you want to display, etc.
          {isLoading && <Spinner />}
          {isSuccess && "You did it!"}
          {isError && "Uh oh, got an error"}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outlined-background"
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Park rig
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

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

const Pilots = ({ rig, nfts }: RigModuleProps) => {
  const { data: blockNumber } = useBlockNumber();
  const pilots = getPilots(rig, nfts, blockNumber);

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

  const totalFlightTime = pilots.reduce(
    (acc, { flightTime }) => acc + flightTime,
    0
  );

  return (
    <>
      <VStack align="stretch" bg="paper" spacing={GRID_GAP} pt={PAPER_TABLE_PT}>
        <HStack
          px={PAPER_TABLE_HEADING_PX}
          justify="space-between"
          sx={{ width: "100%" }}
        >
          <Heading>Rig {`#${rig.id}`}</Heading>
          <Heading size="sm">
            {rig.currentPilot ? "In-flight" : "Parked"}
            {` (${prettyNumber(totalFlightTime)} FT)`}
          </Heading>
        </HStack>
        <Table>
          <Thead>
            <Tr>
              <Th pl={8} colSpan={2}>
                Pilot
              </Th>
              <Th>Flight time (FT)</Th>
              <Th pr={8}>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {pilots.map(({ pilot, imageUrl, flightTime, status }, index) => {
              return (
                <Tr key={`pilots-${index}`}>
                  <Td pl={8} pr={0}>
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
                  <Td pl={0}>{pilot}</Td>
                  <Td>{prettyNumber(flightTime)}</Td>
                  <Td pr={8}>{status}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <StackItem px={GRID_GAP} pb={GRID_GAP}>
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
      </VStack>
      <TrainRigModal
        rig={rig}
        isOpen={trainModalOpen}
        onClose={onCloseTrainModal}
      />
      <ParkRigModal
        rig={rig}
        isOpen={parkModalOpen}
        onClose={onCloseParkModal}
      />
    </>
  );
};

const Badges = ({ rig }: RigModuleProps) => {
  const data = [
    {
      badge: "Coding",
      badgeImageUrl: code,
      pilot: "Moonbird #8969",
      visibility: "Visible",
    },
    {
      badge: "Education",
      badgeImageUrl: education,
      pilot: "Trainer",
      visibility: "Hidden",
    },
  ];
  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Badges</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={8} colSpan={2}>
              Name
            </Th>
            <Th>Earned by</Th>
            <Th pr={8}>Visibility</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(({ badge, pilot, visibility, badgeImageUrl }, index) => {
            return (
              <Tr key={`badges-${index}`}>
                <Td pl={8} pr={0}>
                  <Image src={badgeImageUrl} width="30px" height="30px" />
                </Td>
                <Td pl={0}>{badge}</Td>
                <Td>{pilot}</Td>
                <Td pr={8}>{visibility}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};

const FlightLog = ({ rig, nfts }: RigModuleProps) => {
  const events = rig.pilotSessions
    .flatMap(({ startTime, endTime, contract, tokenId }) => {
      const { name = "Trainer" } = findNFT({ tokenId, contract }, nfts) || {};

      let events = [{ type: `Piloted ${name}`, timestamp: startTime }];

      if (endTime) {
        events = [...events, { type: "Parked", timestamp: endTime }];
      }

      return events;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Flight log</Heading>
      <Table>
        <Tbody>
          {events.map(({ type }, index) => {
            return (
              <Tr key={`flight-log-${index}`}>
                <Td pl={8}>{type}</Td>
                <Td pr={8} isNumeric>
                  0x96ff...4651
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};

export const RigDetails = () => {
  const { id } = useParams();
  const { rig } = useRig(id || "");
  const { nfts } = useNFTs(rig?.pilotSessions || []);

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
                <RigAttributes rig={rig} nfts={nfts} />
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Pilots rig={rig} nfts={nfts} />
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
