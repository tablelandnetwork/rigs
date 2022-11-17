import React, { useEffect } from "react";
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
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { Rig } from "../types";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { contractAddress, contractInterface } from "../contract";

interface ModalProps {
  rigs: Rig[];
  isOpen: boolean;
  onClose: () => void;
  onTransactionSubmitted?: (txHash: string) => void;
}

const pluralize = (s: string, c: any[]): string => {
  return c.length === 1 ? s : `${s}s`;
};

export const TrainRigsModal = ({
  rigs,
  isOpen,
  onClose,
  onTransactionSubmitted,
}: ModalProps) => {
  const { config } = usePrepareContractWrite({
    addressOrName: contractAddress,
    contractInterface,
    functionName:
      rigs.length === 1 ? "trainRig(uint256)" : "trainRig(uint256[])",
    args:
      rigs.length === 1
        ? ethers.BigNumber.from(rigs[0].id)
        : [rigs.map((rig) => ethers.BigNumber.from(rig.id))],
    enabled: isOpen,
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write } = contractWrite;
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: contractWrite.data?.hash,
  });

  useEffect(() => {
    if (onTransactionSubmitted && isSuccess && contractWrite.data?.hash)
      onTransactionSubmitted(contractWrite.data.hash);
  }, [onTransactionSubmitted, contractWrite?.data, isSuccess]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Train {pluralize("Rig", rigs)}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            Before your Rig can handle a real pilot (an ERC721 token that you
            own), it needs to accumulate enough FT with the trainer. This will
            take about 30 days.
          </Text>
          <Text mt={4} sx={{ fontStyle: "bold" }}>
            In-flight Rigs ARE NOT sellable or transferable! Your Rig may be
            auto-parked if it's listed on a marketplace. If your Rig has a real
            pilot that you sold or transferred, your Rig will be auto-parked if
            the new owner uses it as a pilot of a different Rig.
          </Text>
          <Text mt={4} sx={{ fontStyle: "italic" }}>
            Training requires an on-chain transaction. When you click the Train
            button below your wallet will request that you sign a transaction
            that will cost gas.
          </Text>
          <TransactionStateAlert {...contractWrite} />
        </ModalBody>
        <ModalFooter>
          <Button
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Train {pluralize("rig", rigs)}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            isDisabled={isLoading || (isSuccess && isTxLoading)}
          >
            {isSuccess && !isTxLoading ? "Close" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const ParkRigsModal = ({
  rigs,
  isOpen,
  onClose,
  onTransactionSubmitted,
}: ModalProps) => {
  const { config } = usePrepareContractWrite({
    addressOrName: contractAddress,
    contractInterface,
    functionName: "parkRig(uint256[])",
    args: [rigs.map((rig) => ethers.BigNumber.from(rig.id))],
    enabled: isOpen,
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write } = contractWrite;
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: contractWrite.data?.hash,
  });

  useEffect(() => {
    if (onTransactionSubmitted && isSuccess && contractWrite.data?.hash)
      onTransactionSubmitted(contractWrite.data.hash);
  }, [onTransactionSubmitted, contractWrite?.data, isSuccess]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Park {pluralize("Rig", rigs)}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            Training isn't complete! Be aware that your Rig will lose all of its
            FT if you park now.
          </Text>
          <Text mt={4}>Parked Rigs can be sold or transferred.</Text>
          <Text mt={4} sx={{ fontStyle: "italic" }}>
            Parking requires an on-chain transaction. When you click the Park
            button below your wallet will request that you sign a transaction
            that will cost gas.
          </Text>
          <TransactionStateAlert {...contractWrite} />
        </ModalBody>
        <ModalFooter>
          <Button
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Park {pluralize("rig", rigs)}
          </Button>
          <Button
            variant="ghost"
            isDisabled={isLoading || (isSuccess && isTxLoading)}
            onClick={onClose}
          >
            {isSuccess && !isTxLoading ? "Close" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
