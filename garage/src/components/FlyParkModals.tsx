import React from "react";
import { ethers } from "ethers";
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Text,
} from "@chakra-ui/react";
import { useContractWrite, usePrepareContractWrite } from "wagmi";
import { RigWithPilots } from "../types";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { contractAddress, contractInterface } from "../contract";

interface ModalProps {
  rig: RigWithPilots;
  isOpen: boolean;
  onClose: () => void;
}

export const TrainRigModal = ({ rig, isOpen, onClose }: ModalProps) => {
  const { config } = usePrepareContractWrite({
    addressOrName: contractAddress,
    contractInterface,
    functionName: "trainRig",
    args: ethers.BigNumber.from(rig.id),
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write } = contractWrite;

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
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Train rig
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {isSuccess ? "Close" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const ParkRigModal = ({ rig, isOpen, onClose }: ModalProps) => {
  const { config } = usePrepareContractWrite({
    addressOrName: contractAddress,
    contractInterface,
    functionName: "parkRig",
    args: ethers.BigNumber.from(rig.id),
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write } = contractWrite;

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
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Park rig
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {isSuccess ? "Close" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
