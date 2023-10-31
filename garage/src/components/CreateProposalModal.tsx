import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Table,
  Tbody,
  Td,
  Thead,
  Th,
  Tr,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { as0xString } from "~/utils/types";
import { deployment, secondaryChain } from "~/env";
import { abi } from "~/abis/VotingRegistry";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { ChainAwareButton } from "./ChainAwareButton";

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
  options: string[];
}

const initialFormState = {
  name: "",
  descriptionCid: "",
  voterFtReward: 0,
  startBlock: 0,
  endBlock: 0,
  options: [],
};

export const CreateProposalModal = ({
  isOpen,
  onClose,
  onTransactionSubmitted,
  onTransactionCompleted,
}: ModalProps) => {
  const [
    { name, descriptionCid, voterFtReward, startBlock, endBlock, options },
    setFormState,
  ] = useState<FormState>(initialFormState);

  const isValid =
    name !== "" && startBlock > 0 && endBlock > 0 && options.length > 0;

  const { config } = usePrepareContractWrite({
    chainId: secondaryChain.id,
    address: as0xString(votingContractAddress),
    abi,
    functionName: "createProposal",
    args: [
      name,
      descriptionCid,
      0,
      BigInt(voterFtReward),
      BigInt(startBlock),
      BigInt(endBlock),
      options,
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

  const [option, setOption] = useState("");
  const onOptionInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOption(e.target.value);
    },
    [setOption]
  );

  const addOption = useCallback(() => {
    if (!options) return;

    setFormState((old) => ({
      ...old,
      options: [...old.options, option],
    }));

    setOption("");
  }, [option, setFormState, setOption]);

  const removeOption = useCallback(
    (index: number) => {
      console.log("removeOption", index);
      setFormState((old) => {
        const newOptions = [...old.options];
        newOptions.splice(index, 1);
        return {
          ...old,
          options: newOptions,
        };
      });
    },
    [setFormState]
  );

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
              value={startBlock === 0 ? "" : startBlock}
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
              value={endBlock === 0 ? "" : endBlock}
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
              value={voterFtReward === 0 ? "" : voterFtReward}
              onChange={onVoterFtRewardInputChanged}
              size="md"
              mb={4}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Options:</FormLabel>
            <Input
              focusBorderColor="primary"
              variant="outline"
              value={option}
              onChange={onOptionInputChanged}
              size="md"
              mb={4}
            />
            <Button onClick={addOption}>Add</Button>
          </FormControl>
          <Table mt={4}>
            <Thead>
              <Tr>
                <Th>Option</Th>
                <Th isNumeric>Delete</Th>
              </Tr>
            </Thead>

            <Tbody>
              {options.map((v, i) => (
                <Tr key={`option-${i}`}>
                  <Td>{v}</Td>
                  <Td isNumeric>
                    <IconButton
                      aria-label="Delete option"
                      icon={<DeleteIcon />}
                      onClick={() => removeOption(i)}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <TransactionStateAlert {...contractWrite} />
        </ModalBody>
        <ModalFooter>
          <ChainAwareButton
            expectedChain={secondaryChain}
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={!isValid || isLoading || isSuccess}
          >
            Create
          </ChainAwareButton>
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
