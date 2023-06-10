import React, { useCallback, useEffect, useState } from "react";
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
} from "@chakra-ui/react";
import { ethers } from "ethers";
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { as0xString } from "../utils/types";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { deployment } from "../env";
import { abi } from "../abis/VotingRegistry";

const { votingContractAddress } = deployment;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionSubmitted?: (txHash: string) => void;
  onTransactionCompleted?: (success: boolean) => void;
}

export const CreateProposalModal = ({
  isOpen,
  onClose,
  onTransactionSubmitted,
  onTransactionCompleted,
}: ModalProps) => {
  const [name, setName] = useState("");
  const [voterFtReward, setVoterFtReward] = useState(0);
  const [startBlock, setStartBlock] = useState(0);
  const [endBlock, setEndBlock] = useState(0);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [alternative, setAlternative] = useState("");

  const isValid =
    name !== "" && startBlock > 0 && endBlock > 0 && alternatives.length > 0;

  const { config } = usePrepareContractWrite({
    address: as0xString(votingContractAddress),
    abi,
    functionName: "createProposal",
    args: [
      alternatives,
      name,
      ethers.BigNumber.from(voterFtReward),
      ethers.BigNumber.from(startBlock),
      ethers.BigNumber.from(endBlock),
    ],
    enabled: isOpen && isValid,
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write, reset, data } = contractWrite;
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: data?.hash,
  });

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

  const onNameInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
    },
    [setName]
  );

  const onVoterFtRewardInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value)
      setVoterFtReward(isNaN(value) ? 0 : value);
    },
    [setVoterFtReward]
  );

  const onStartInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value)
      setStartBlock(isNaN(value) ? 0 : value);
    },
    [setStartBlock]
  );

  const onEndInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value)
      setEndBlock(isNaN(value) ? 0 : value);
    },
    [setEndBlock]
  );

  const onAlternativeInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAlternative(e.target.value);
    },
    [setAlternative]
  );

  const addAlternative = useCallback(() => {
    if (!alternatives) return;

    setAlternatives((old) => [...old, alternative]);

    setAlternative("");
  }, [alternative, setAlternatives, setAlternatives]);

  useEffect(() => {
    if (isOpen) setName("");
  }, [isOpen, setName]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create Proposal</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel>Name:</FormLabel>
            <Input
              focusBorderColor="primary"
              variant="outline"
              value={name}
              onChange={onNameInputChanged}
              isInvalid={name === ""}
              size="md"
              mb={4}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Start block:</FormLabel>
            <Input
              focusBorderColor="primary"
              type="number"
              variant="outline"
              value={startBlock}
              onChange={onStartInputChanged}
              isInvalid={startBlock === 0}
              size="md"
              mb={4}
            />
          </FormControl>
          <FormControl>
            <FormLabel>End block:</FormLabel>
            <Input
              focusBorderColor="primary"
              type="number"
              variant="outline"
              value={endBlock}
              onChange={onEndInputChanged}
              isInvalid={endBlock === 0}
              size="md"
              mb={4}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Voter FT Reward:</FormLabel>
            <Input
              focusBorderColor="primary"
              type="number"
              variant="outline"
              value={voterFtReward}
              onChange={onVoterFtRewardInputChanged}
              size="md"
              mb={4}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Alternatives:</FormLabel>
            <Input
              focusBorderColor="primary"
              variant="outline"
              value={alternative}
              onChange={onAlternativeInputChanged}
              size="md"
              mb={4}
            />
            <Button onClick={addAlternative}>Add</Button>
          </FormControl>
          {alternatives.map((v) => (
            <p>{v}</p>
          ))}
          <TransactionStateAlert {...contractWrite} />
        </ModalBody>
        <ModalFooter>
          <Button
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={!isValid || isLoading || isSuccess}
          >
            Create
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
