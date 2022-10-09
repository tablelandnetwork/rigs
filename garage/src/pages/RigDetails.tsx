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
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useBlockNumber,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import { useRig, RigWithGarageStatus } from "../hooks/useRig";
import { useRigImageUrls } from "../hooks/useRigImageUrls";
import { CONTRACT_ADDRESS, CONTRACT_INTERFACE } from "../settings";
import { prettyNumber } from "../utils/fmt";

const GRID_GAP = 4;
const PAPER_TABLE_PT = 8;
const PAPER_TABLE_HEADING_PX = 8;

interface RigModuleProps {
  rig: RigWithGarageStatus;
}

const RigViewer = ({ rig }: RigModuleProps) => {
  const { image: imageUrl } = useRigImageUrls(rig);

  // TODO: render pilot & badges
  return (
    <Box bg="paper" p={2}>
      <Image src={imageUrl} />
    </Box>
  );
};

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
  rig: RigWithGarageStatus;
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
          Before your Rig can handle any pilot it needs to go through training
          for 30 days with the training pilot.
          <i>
            Training your rig requires an on-chain transaction. When you click
            the Train button below your wallet will request that you sign a
            transaction that will cost a small gas fee.
          </i>
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

const getPilots = (rig: RigWithPilots, blockNumber: number | undefined) => {
  const accumulator: { [key: string]: PilotSession[] } = {};

  const pilots = rig.pilotSessions.reduce((acc, session) => {
    const key = session.contract + session.tokenId;
    (acc[key] = acc[key] || []).push(session);
    return acc;
  }, accumulator);

  return Object.values(pilots).map((sessions) => {
    const { contract, tokenId } = sessions[0];

    const status = sessions.find((v) => !v.endTime) ? "Active" : "Garaged";

    const flightTime = sessions.reduce((acc, { startTime, endTime }) => {
      return acc + ((endTime ?? blockNumber ?? startTime) - startTime);
    }, 0);

    return {
      contract,
      tokenId,
      flightTime,
      status,
    };
  });
};

const Pilots = ({ rig }: RigModuleProps) => {
  const { data: blockNumber } = useBlockNumber();
  const pilots = getPilots(rig, blockNumber);

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
    <>
      <VStack align="stretch" bg="paper" spacing={GRID_GAP} pt={PAPER_TABLE_PT}>
        <Heading px={PAPER_TABLE_HEADING_PX}>Rig {`#${rig.id}`}</Heading>
        <Table>
          <Thead>
            <Tr>
              <Th pl={8}>Pilot</Th>
              <Th>Flight time (FT)</Th>
              <Th pr={8}>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {pilots.map(({ contract, tokenId, flightTime, status }, index) => {
              return (
                <Tr key={`pilots-${index}`}>
                  <Td pl={8}>{`${contract} #${tokenId}`}</Td>
                  <Td>{prettyNumber(flightTime)}</Td>
                  <Td pr={8}>{status}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <StackItem px={GRID_GAP} pb={GRID_GAP}>
          {rig.garageStatus.state === "PARKED" && (
            <Button variant="outlined" onClick={onOpenTrainModal} width="100%">
              Train
            </Button>
          )}
          {rig.garageStatus.state === "FLYING" && (
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
    { badge: "Coding", pilot: "Moonbird #8969", visibility: "Visible" },
    { badge: "Education", pilot: "Trainer", visibility: "Hidden" },
  ];
  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Badges</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={8}>Name</Th>
            <Th>Earned by</Th>
            <Th pr={8}>Visibility</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(({ badge, pilot, visibility }, index) => {
            return (
              <Tr key={`badges-${index}`}>
                <Td pl={8}>{badge}</Td>
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

const FlightLog = ({ rig }: RigModuleProps) => {
  const data = [
    { event: "Earned Coding Badge", wallet: "0x96ff...4651" },
    { event: "Piloted Moonbird #8979", wallet: "0x96ff...4651" },
    { event: "Parked", wallet: "0x96ff...4651" },
    { event: "Earned Education Badge", wallet: "0x96ff...4651" },
    { event: "Piloted Trainer", wallet: "0x96ff...4651" },
  ];

  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Flight log</Heading>
      <Table>
        <Tbody>
          {data.map(({ event, wallet }, index) => {
            return (
              <Tr key={`flight-log-${index}`}>
                <Td pl={8}>{event}</Td>
                <Td pr={8} isNumeric>
                  {wallet}
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
        {rig && (
          <>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <RigViewer rig={rig} />
                <RigAttributes rig={rig} />
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Pilots rig={rig} />
                <Badges rig={rig} />
                <FlightLog rig={rig} />
              </VStack>
            </GridItem>
          </>
        )}

        {!rig && <Spinner />}
      </Grid>
    </Flex>
  );
};
