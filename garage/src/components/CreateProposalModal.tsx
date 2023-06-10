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
  Text,
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

interface FormState {
  name: string;
  descriptionCid: string;
  voterFtReward: number;
  startBlock: number;
  endBlock: number;
  alternatives: string[];
}

const initialFormState = {
  name: "",
  descriptionCid: "",
  voterFtReward: 0,
  startBlock: 0,
  endBlock: 0,
  alternatives: [],
};

export const CreateProposalModal = ({
  isOpen,
  onClose,
  onTransactionSubmitted,
  onTransactionCompleted,
}: ModalProps) => {
  const [
    { name, descriptionCid, voterFtReward, startBlock, endBlock, alternatives },
    setFormState,
  ] = useState<FormState>(initialFormState);

  const isValid =
    name !== "" &&
    startBlock > 0 &&
    endBlock > 0 &&
    voterFtReward > 0 &&
    alternatives.length > 0;

  const { config } = usePrepareContractWrite({
    address: as0xString(votingContractAddress),
    abi,
    functionName: "createProposal",
    args: [
      name,
      descriptionCid,
      ethers.BigNumber.from(voterFtReward),
      ethers.BigNumber.from(startBlock),
      ethers.BigNumber.from(endBlock),
      alternatives,
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
      setFormState((old) => ({ ...old, name: e.target.value }));
    },
    [setFormState]
  );

  const onDescriptionCidInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((old) => ({ ...old, descriptionCid: e.target.value }));
    },
    [setFormState]
  );

  const onVoterFtRewardInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setFormState((old) => ({
        ...old,
        voterFtReward: isNaN(value) ? 0 : value,
      }));
    },
    [setFormState]
  );

  const onStartInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setFormState((old) => ({ ...old, startBlock: isNaN(value) ? 0 : value }));
    },
    [setFormState]
  );

  const onEndInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setFormState((old) => ({ ...old, endBlock: isNaN(value) ? 0 : value }));
    },
    [setFormState]
  );

  const [alternative, setAlternative] = useState("");
  const onAlternativeInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAlternative(e.target.value);
    },
    [setAlternative]
  );

  const addAlternative = useCallback(() => {
    if (!alternatives) return;

    setFormState((old) => ({
      ...old,
      alternatives: [...old.alternatives, alternative],
    }));

    setAlternative("");
  }, [alternative, setFormState, setAlternative]);

  // TODO support removing an alternative

  useEffect(() => {
    if (isOpen) setFormState(initialFormState);
  }, [isOpen, setFormState]);

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
            <FormLabel>Description Markdown File CID:</FormLabel>
            <Input
              focusBorderColor="primary"
              variant="outline"
              value={descriptionCid}
              onChange={onDescriptionCidInputChanged}
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
          {alternatives.map((v, i) => (
            <Text key={`alternative-${i}`}>{v}</Text>
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
