import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Text,
} from "@chakra-ui/react";
import { WarningTwoIcon } from "@chakra-ui/icons";
import { ethers } from "ethers";
import {
  useAccount,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { useTablelandTokenGatedContractWriteFn } from "../hooks/useTablelandTokenGatedContractWriteFn";
import { Rig, isValidAddress } from "../types";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { RigDisplay } from "./RigDisplay";
import { address as contractAddress, abi } from "../contract";

interface ModalProps {
  rig: Rig;
  isOpen: boolean;
  onClose: () => void;
  onTransactionSubmitted?: (txHash: string) => void;
  onTransactionCompleted?: (success: boolean) => void;
}

export const TransferRigModal = ({
  rig,
  isOpen,
  onClose,
  onTransactionSubmitted,
  onTransactionCompleted,
}: ModalProps) => {
  const { address } = useAccount();
  const [toAddress, setToAddress] = useState("");

  const isValidToAddress = useMemo(() => {
    return isValidAddress(toAddress);
  }, [toAddress]);

  const { config } = usePrepareContractWrite({
    address: contractAddress,
    abi,
    functionName: rig.currentPilot
      ? "safeTransferWhileFlying"
      : "safeTransferFrom",
    args:
      address && isValidToAddress && isValidAddress(toAddress)
        ? [address, toAddress, ethers.BigNumber.from(rig.id)]
        : undefined,
    enabled: isOpen && isValidToAddress,
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write: _write, reset, data } = contractWrite;
  const write = useTablelandTokenGatedContractWriteFn(_write);
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: data?.hash,
  });

  const onInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setToAddress(e.target.value);
    },
    [setToAddress]
  );

  useEffect(() => {
    if (isOpen) setToAddress("");
  }, [isOpen, setToAddress]);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (onTransactionSubmitted && isSuccess && data?.hash)
      onTransactionSubmitted(data.hash);
  }, [onTransactionSubmitted, data, isSuccess]);

  useEffect(() => {
    if (onTransactionCompleted && data && !isTxLoading)
      onTransactionCompleted(isSuccess);
  }, [onTransactionCompleted, isTxLoading, isSuccess, data]);

  const { currentPilot, ...rigWithoutPilot } = rig;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Transfer Rig #{rig.id}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <RigDisplay
            rig={rigWithoutPilot}
            width="200px"
            height="200px"
            mx="auto"
            my="30px"
          />
          <Text pb={6}>
            Do you want to transfer your Rig to another wallet?
          </Text>
          <FormControl>
            <FormLabel>To address:</FormLabel>
            <Input
              placeholder="e.g., 0x0123.."
              focusBorderColor="primary"
              variant="outline"
              value={toAddress}
              onChange={onInputChanged}
              isInvalid={toAddress !== "" && !isValidToAddress}
              size="md"
              mb={4}
            />
          </FormControl>
          <Text fontSize="sm" mx={4} align="center">
            <WarningTwoIcon mr={2} color="orange" />
            Items sent to the wrong address cannot be recovered
          </Text>
          <TransactionStateAlert {...contractWrite} />
        </ModalBody>
        <ModalFooter>
          <Button
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={!isValidToAddress || isLoading || isSuccess}
          >
            Transfer Rig
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
