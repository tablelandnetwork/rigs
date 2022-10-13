import React from "react";
import { ethers } from "ethers";
import {
  Box,
  Button,
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
import { RigWithPilots, PilotSession } from "../../../types";
import { TrainerPilot } from "../../../components/TrainerPilot";
import { TransactionStateAlert } from "../../../components/TransactionStateAlert";
import {
  useBlockNumber,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import { NFT } from "../../../hooks/useNFTs";
import { findNFT } from "../../../utils/nfts";
import { CONTRACT_ADDRESS, CONTRACT_INTERFACE } from "../../../settings";
import { prettyNumber } from "../../../utils/fmt";

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

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write } = contractWrite;

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
          <TransactionStateAlert {...contractWrite} />
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

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write } = contractWrite;

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
          <TransactionStateAlert {...contractWrite} />
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

type PilotProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  nfts: NFT[];
  isOwner: boolean;
};

export const Pilots = ({ rig, nfts, isOwner, p, ...props }: PilotProps) => {
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
                  <Td pl={p} pr={0}>
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
                  <Td
                    pr={p}
                    color={status == "Garaged" ? "inactive" : "inherit"}
                  >
                    {status}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        {isOwner && (
          <StackItem px={4} pb={4}>
            {!rig.currentPilot && (
              <Button
                variant="outlined"
                onClick={onOpenTrainModal}
                width="100%"
              >
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
