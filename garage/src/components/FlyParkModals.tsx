import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  Box,
  Button,
  Flex,
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
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { ArrowBackIcon, ArrowForwardIcon } from "@chakra-ui/icons";
import {
  useAccount,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { useOwnedNFTs, NFT } from "../hooks/useNFTs";
import { useActivePilotSessions } from "../hooks/useActivePilotSessions";
import { useTablelandTokenGatedContractWriteFn } from "../hooks/useTablelandTokenGatedContractWriteFn";
import { Rig } from "../types";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { RigDisplay } from "./RigDisplay";
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
  const { isLoading, isSuccess, write: _write, reset } = contractWrite;
  const write = useTablelandTokenGatedContractWriteFn(_write);
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: contractWrite.data?.hash,
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

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
  const { isLoading, isSuccess, write: _write, reset } = contractWrite;
  const write = useTablelandTokenGatedContractWriteFn(_write);
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: contractWrite.data?.hash,
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

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

interface PilotTransactionProps {
  pairs: { rig: Rig; pilot: NFT }[];
  isOpen: boolean;
  onClose: () => void;
  onTransactionSubmitted?: (txHash: string) => void;
}

const toContractArgs = (pairs: { rig: Rig; pilot: NFT }[]) => {
  return [
    pairs.map(({ rig }) => ethers.BigNumber.from(rig.id)),
    pairs.map(({ pilot }) => pilot.contract),
    pairs.map(({ pilot }) => ethers.BigNumber.from(pilot.tokenId)),
  ];
};

const PilotTransactionStep = ({
  pairs,
  isOpen,
  onClose,
  onTransactionSubmitted,
}: PilotTransactionProps) => {
  // TODO support calling pilotRig(uint256, address, uint256) for a single rig?
  const { config } = usePrepareContractWrite({
    addressOrName: contractAddress,
    contractInterface,
    functionName: "pilotRig(uint256[],address[],uint256[])",
    args: toContractArgs(pairs),
    enabled: isOpen,
  });

  const { sessions } = useActivePilotSessions(pairs.map(v => v.pilot));

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write: _write, reset } = contractWrite;
  const write = useTablelandTokenGatedContractWriteFn(_write);
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: contractWrite.data?.hash,
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (onTransactionSubmitted && isSuccess && contractWrite.data?.hash)
      onTransactionSubmitted(contractWrite.data.hash);
  }, [onTransactionSubmitted, contractWrite?.data, isSuccess]);

  return (
    <>
      <ModalBody>
        <Text>You are about to pilot your {pluralize("rig", pairs)}!</Text>
        <Text mt={4} sx={{ fontStyle: "bold" }}>
          In-flight Rigs ARE NOT sellable or transferable! Your Rig may be
          auto-parked if it's listed on a marketplace. If your Rig has a real
          pilot that you sold or transferred, your Rig will be auto-parked if
          the new owner uses it as a pilot of a different Rig.
        </Text>
        <Text mt={4} sx={{ fontStyle: "italic" }}>
          Piloting requires an on-chain transaction. When you click the Pilot
          button below your wallet will request that you sign a transaction that
          will cost gas.
        </Text>
        {!sessions && <Spinner />}
        {sessions && sessions.length > 0 && (
          <Box>
            <Heading as="h2">WARNING</Heading>
            <Text>
              The following Pilots are already in use by other Rigs. Piloting
              with these pilots will force park the rigs below.
            </Text>
            <Table>
              <Thead>
                <Tr>
                  <Th>Rig #</Th>
                  <Th>Owner</Th>
                  <Th>Pilot Contract</Th>
                  <Th>Pilot Token Id</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sessions.map(({ rigId, owner, contract, tokenId }, index) => {
                  return (
                    <Tr key={`warning-${index}`}>
                      <Td>{rigId}</Td>
                      <Td>{owner}</Td>
                      <Td>{contract}</Td>
                      <Td>{tokenId}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
        <TransactionStateAlert {...contractWrite} />
      </ModalBody>
      <ModalFooter>
        <Button
          mr={3}
          onClick={() => (write ? write() : undefined)}
          isDisabled={isLoading || isSuccess || !sessions}
        >
          Pilot {pluralize("rig", pairs)}
        </Button>
        <Button
          variant="ghost"
          onClick={onClose}
          isDisabled={isLoading || (isSuccess && isTxLoading)}
        >
          {isSuccess && !isTxLoading ? "Close" : "Cancel"}
        </Button>
      </ModalFooter>
    </>
  );
};

const NFTDisplay = ({ nft, selected }: { nft: NFT; selected: boolean }) => {
  return (
    <Box width={{ base: "120px", md: "200px" }} position="relative">
      <Image src={nft.imageUrl} />
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
        _hover={{ backgroundColor: "rgba(0,0,0,0.15)" }}
        transition=".2s"
      />
      {nft.name} {selected && "√ SELECTED"}
    </Box>
  );
};

type RigPilotMap = { [rigId: string]: NFT };

interface PickRigPilotStepProps {
  rigs: Rig[];
  pilots: RigPilotMap;
  setPilot: (pilot: NFT, rigId: string) => void;
  onNext: () => void;
  onClose: () => void;
}

const PickRigPilotStep = ({
  rigs,
  pilots,
  setPilot,
  onNext,
  onClose,
}: PickRigPilotStepProps) => {
  const { address } = useAccount();
  const { nfts } = useOwnedNFTs(address, 20, "");

  const [currentRig, setCurrentRig] = useState<number>(0);
  const rig = useMemo(() => rigs[currentRig], [rigs, currentRig]);
  const pilot = useMemo(() => pilots[rigs[currentRig].id], [pilots, rigs, currentRig]);

  const next = useCallback(() => {
    setCurrentRig((old) => {
      if (old === rigs.length - 1) return old;

      return old++;
    });
  }, [setCurrentRig, rigs]);

  const prev = useCallback(() => {
    setCurrentRig((old) => {
      if (old === 0) return old;

      return old--;
    });
  }, [setCurrentRig, rigs]);

  const displayArrows = useMemo(() => {
    return rigs.length > 1;
  }, [rigs]);

  return (
    <>
      <ModalBody>
        <Flex direction="column">
          <Flex justify="center" width="100%">
            {displayArrows && (
              <Button
                leftIcon={<ArrowBackIcon />}
                onClick={prev}
                isDisabled={currentRig === 0}
              >
                Prev
              </Button>
            )}
            <Flex
              direction="row"
              borderColor="primary"
              borderWidth="1px"
              borderRadius="5px"
              p={4}
            >
              <RigDisplay rig={rig} pilotNFT={pilot} width="100px" />
              <Flex direction="column" ml={3}>
                <Heading as="h3">Rig #{rig.id}</Heading>
              </Flex>
            </Flex>
          </Flex>
          {displayArrows && (
            <Button
              leftIcon={<ArrowForwardIcon />}
              onClick={next}
              isDisabled={currentRig === rigs.length - 1}
            >
              Next
            </Button>
          )}
        </Flex>

        {/*<InputGroup>
        <InputLeftElement
          pointerEvents="none"
          children={<SearchIcon color="gray.300" />}
        />
        <Input type="text" placeholder="Filter on Collection" />
      </InputGroup>*/}
        <Heading as="h4">Your NFTs (ERC721 only)</Heading>
        <Flex direction="row" wrap="wrap" justify="space-between">
          {nfts &&
            nfts.map((nft, index) => {
              return (
                <Flex
                  direction="column"
                  key={index}
                  onClick={() => setPilot(nft, rigs[currentRig].id)}
                  _hover={{ cursor: "pointer" }}
                >
                  <NFTDisplay nft={nft} selected={pilot === nft} />
                </Flex>
              );
            })}
          {!nfts && <Spinner />}
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button
          mr={3}
          onClick={onNext}
          isDisabled={
            rigs.length === 0 || Object.keys(pilots).length !== rigs.length
          }
        >
          Pilot {pluralize("rig", rigs)}
        </Button>
        <Button variant="ghost" onClick={onClose} isDisabled={false}>
          Cancel
        </Button>
      </ModalFooter>
    </>
  );
};

export const PilotRigsModal = ({
  rigs,
  isOpen,
  onClose,
  onTransactionSubmitted,
}: ModalProps) => {
  const [pilots, setPilots] = useState<RigPilotMap>({});
  const setPilot = useCallback(
    (pilot: NFT, rigId: string) => {
      setPilots((old) => {
        let addition: RigPilotMap = {};
        addition[rigId] = pilot;
        return {
          ...old,
          ...addition,
        };
      });
    },
    [setPilots]
  );

  const [step, setStep] = useState<"choose" | "confirm">("choose");

  const pairs = useMemo(() => {
    return rigs.map((rig, index) => ({ rig, pilot: pilots[rig.id] }));
  }, [rigs, pilots]);

  // Effect that resets the state when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      setPilots({});
      setStep("choose");
    }
  }, [isOpen, setPilots, setStep]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Choose Pilot</ModalHeader>
        <ModalCloseButton />
        {step === "choose" && (
          <PickRigPilotStep
            rigs={rigs}
            setPilot={setPilot}
            pilots={pilots}
            onClose={onClose}
            onNext={() => setStep("confirm")}
          />
        )}
        {step === "confirm" && (
          <PilotTransactionStep
            pairs={pairs}
            isOpen={isOpen}
            onClose={onClose}
            onTransactionSubmitted={onTransactionSubmitted}
          />
        )}
      </ModalContent>
    </Modal>
  );
};
