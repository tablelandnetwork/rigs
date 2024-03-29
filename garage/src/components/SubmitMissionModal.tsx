import React, { useCallback, useEffect, useState } from "react";
import isEmpty from "lodash/isEmpty";
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
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { as0xString } from "~/utils/types";
import { Mission } from "~/types";
import { secondaryChain, deployment } from "~/env";
import { abi } from "~/abis/MissionsManager";
import { useWaitForTablelandTxn } from "~/hooks/useWaitForTablelandTxn";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { ChainAwareButton } from "./ChainAwareButton";

const { missionContractAddress } = deployment;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: Mission;
  onTransactionSubmitted?: (txHash: string) => void;
  onTransactionCompleted?: (success: boolean) => void;
  refresh: () => void;
}

interface FormState {
  deliverables: { key: string; value: string }[];
}

export const SubmitMissionModal = ({
  isOpen,
  onClose,
  mission,
  onTransactionSubmitted,
  onTransactionCompleted,
  refresh,
}: ModalProps) => {
  const initialState = {
    deliverables: mission.deliverables.map(({ key }) => ({ key, value: "" })),
  };
  const [formState, setFormState] = useState<FormState>(initialState);

  const { deliverables } = formState;

  const isValid =
    deliverables.length === mission.deliverables.length &&
    !deliverables.map(({ value }) => value).some(isEmpty);

  const sanitizeDeliverables = deliverables.map(({ key, value }) => ({
    [key]: value.replace(/\'/g, "''"),
  }));
  const { config } = usePrepareContractWrite({
    chainId: secondaryChain.id,
    address: as0xString(missionContractAddress),
    abi,
    functionName: "submitMissionContribution",
    args: [BigInt(mission.id), JSON.stringify(sanitizeDeliverables)],
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

  useWaitForTablelandTxn(secondaryChain.id, data?.hash, refresh, refresh);

  const onInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, atIndex: number) => {
      const newValue = e.target.value;
      setFormState((old) => {
        return {
          ...old,
          deliverables: old.deliverables.map((old, index) =>
            index === atIndex ? { ...old, value: newValue } : old
          ),
        };
      });
    },
    [setFormState]
  );

  useEffect(() => {
    if (isOpen) setFormState(initialState);
  }, [isOpen, setFormState]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Submit mission contribution</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            {mission.deliverables.map(({ description, type }, i) => {
              return (
                <React.Fragment key={`deliverable-${i}`}>
                  <FormLabel>
                    {description} ({type})
                  </FormLabel>
                  <Input
                    focusBorderColor="primary"
                    variant="outline"
                    value={deliverables[i].value}
                    onChange={(e) => onInputChanged(e, i)}
                    isInvalid={deliverables[i].value === ""}
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
          <ChainAwareButton
            expectedChain={secondaryChain}
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={!isValid || isLoading || isSuccess}
          >
            Submit
          </ChainAwareButton>
          <Button
            variant="ghost"
            onClick={onClose}
            isDisabled={(isValid && isLoading) || (isSuccess && isTxLoading)}
          >
            {isSuccess && !isTxLoading ? "Close" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
