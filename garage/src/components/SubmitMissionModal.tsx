import React, { useCallback, useEffect, useState } from "react";
import isEmpty from "lodash/isEmpty";
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
import { as0xString } from "../utils/types";
import { Mission } from "../types";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { deployment } from "../env";
import { abi } from "../abis/VotingRegistry";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: Mission;
  onTransactionSubmitted?: (txHash: string) => void;
  onTransactionCompleted?: (success: boolean) => void;
}

interface FormState {
  deliverables: string[];
}

const initialFormState = {
  deliverables: [],
};

export const SubmitMissionModal = ({
  isOpen,
  onClose,
  mission,
  onTransactionSubmitted,
  onTransactionCompleted,
}: ModalProps) => {
  const [{ deliverables }, setFormState] = useState<FormState>(
    initialFormState
  );

  const isValid =
    deliverables.length === mission.deliverables.length &&
    !deliverables.some(isEmpty);

  // const { config } = usePrepareContractWrite({
  //   address: as0xString(votingContractAddress),
  //   abi,
  //   functionName: "createProposal",
  //   args: [
  //     name,
  //     descriptionCid,
  //     BigInt(voterFtReward),
  //     BigInt(startBlock),
  //     BigInt(endBlock),
  //     options,
  //   ],
  //   enabled: isOpen && isValid,
  // });

  const config = {};

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

  const onInputChanged = useCallback(
    (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
      // TODO implement
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
        <ModalHeader>Mission submission</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            {mission.deliverables.map(({ name, description }, i) => {
              return (
                <React.Fragment key={`deliverable-${i}`}>
                  <FormLabel>
                    {description} ({name})
                  </FormLabel>
                  <Input
                    focusBorderColor="primary"
                    variant="outline"
                    value={deliverables[i]}
                    onChange={(e) => onInputChanged(i, e)}
                    isInvalid={deliverables[i] === ""}
                    size="md"
                    mb={4}
                  />
                </React.Fragment>
              );
            })}
          </FormControl>
          <TransactionStateAlert {...contractWrite} />
        </ModalBody>
        <ModalFooter>
          <Button
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={!isValid || isLoading || isSuccess}
          >
            Submit
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
