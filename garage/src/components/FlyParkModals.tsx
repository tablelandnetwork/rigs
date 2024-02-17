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
  Tag,
  TagCloseButton,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import {
  ArrowBackIcon,
  ArrowForwardIcon,
  CheckCircleIcon,
  NotAllowedIcon,
  SearchIcon,
} from "@chakra-ui/icons";
import {
  AsyncSelect,
  DropdownIndicatorProps,
  chakraComponents,
} from "chakra-react-select";
import debounce from "lodash/debounce";
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { useAccount } from "~/hooks/useAccount";
import {
  useOwnedNFTs,
  Collection,
  NFT,
  alchemy,
  toCollection,
} from "~/hooks/useNFTs";
import { useActivePilotSessions } from "~/hooks/useActivePilotSessions";
import { Rig, WalletAddress } from "~/types";
import { mainChain, deployment } from "~/env";
import { abi } from "~/abis/TablelandRigs";
import { copySet, toggleInSet } from "~/utils/set";
import { pluralize } from "~/utils/fmt";
import { isPresent, isValidAddress, as0xString } from "~/utils/types";
import unknownPilot from "~/assets/unknown-pilot.svg";
import { ChainAwareButton } from "./ChainAwareButton";
import { TransactionStateAlert } from "./TransactionStateAlert";
import { RigDisplay } from "./RigDisplay";

const { contractAddress } = deployment;

interface ModalProps {
  rigs: Rig[];
  isOpen: boolean;
  onClose: () => void;
  onTransactionSubmitted?: (txHash: string) => void;
}

export const TrainRigsModal = ({
  rigs,
  isOpen,
  onClose,
  onTransactionSubmitted,
}: ModalProps) => {
  const { config } = usePrepareContractWrite({
    chainId: mainChain.id,
    address: as0xString(contractAddress),
    abi,
    functionName: "trainRig",
    args: [rigs.map((rig) => BigInt(rig.id))],
    enabled: isOpen,
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write, reset } = contractWrite;
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
          <ChainAwareButton
            expectedChain={mainChain}
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Train {pluralize("rig", rigs)}
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

export const ParkRigsModal = ({
  rigs,
  isOpen,
  onClose,
  onTransactionSubmitted,
}: ModalProps) => {
  const { config } = usePrepareContractWrite({
    chainId: mainChain.id,
    address: as0xString(contractAddress),
    abi,
    functionName: "parkRig",
    args: [rigs.map((rig) => BigInt(rig.id))],
    enabled: isOpen,
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write, reset } = contractWrite;
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: contractWrite.data?.hash,
  });

  const hasNotCompletedTraining = rigs.some((v) => !v.isTrained);

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
          {hasNotCompletedTraining && (
            <Text mb={4}>
              Training isn't complete! Be aware that your{" "}
              {pluralize("Rig", rigs)} will lose all of its FT if you park now.
            </Text>
          )}
          <Text>Parked Rigs can be sold or transferred.</Text>
          <Text mt={4} sx={{ fontStyle: "italic" }}>
            Parking requires an on-chain transaction. When you click the Park
            button below your wallet will request that you sign a transaction
            that will cost gas.
          </Text>
          <TransactionStateAlert {...contractWrite} />
        </ModalBody>
        <ModalFooter>
          <ChainAwareButton
            expectedChain={mainChain}
            mr={3}
            onClick={() => (write ? write() : undefined)}
            isDisabled={isLoading || isSuccess}
          >
            Park {pluralize("rig", rigs)}
          </ChainAwareButton>
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
  pairs: { rig: Rig; pilot?: NFT }[];
  isOpen: boolean;
  onClose: () => void;
  onTransactionSubmitted?: (txHash: string) => void;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

const toContractArgs = (
  pairs: { rig: Rig; pilot?: NFT }[]
): [bigint[], WalletAddress[], bigint[]] => {
  const validPairs = pairs
    .map(({ pilot, ...rest }) => {
      if (pilot && isValidAddress(pilot.contract)) {
        return {
          ...rest,
          pilotContract: pilot.contract,
          pilotTokenId: pilot.tokenId,
        };
      }
      return { ...rest, pilotContract: ZERO_ADDR, pilotTokenId: 0 };
    })
    .filter(isPresent);

  return [
    validPairs.map(({ rig }) => BigInt(rig.id)),
    validPairs.map(({ pilotContract }) => pilotContract),
    validPairs.map(({ pilotTokenId }) => BigInt(pilotTokenId)),
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
    chainId: mainChain.id,
    address: as0xString(contractAddress),
    abi,
    functionName: "pilotRig",
    args: toContractArgs(pairs),
    enabled: isOpen,
  });

  const { sessions } = useActivePilotSessions(
    pairs.map((v) => v.pilot).filter(isPresent)
  );

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write, reset } = contractWrite;
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
          <Box my={8}>
            <Heading as="h2" mb={3} color="red">
              WARNING!
            </Heading>
            <Text mb={2}>
              The following Pilots are already in use by other Rigs. Piloting
              with these pilots will force park the rigs listed below.
            </Text>
            <Table>
              <Thead>
                <Tr>
                  <Th>Pilot</Th>
                  <Th>Used By Owner</Th>
                  <Th isNumeric>In Rig</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sessions.map(({ rigId, owner, contract, tokenId }, index) => {
                  return (
                    <Tr key={`warning-${index}`}>
                      <Td>
                        {contract} #{tokenId}
                      </Td>
                      <Td>{owner}</Td>
                      <Td isNumeric>#{rigId}</Td>
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
        <ChainAwareButton
          expectedChain={mainChain}
          mr={3}
          onClick={() => (write ? write() : undefined)}
          isDisabled={isLoading || isSuccess || !sessions}
        >
          Pilot {pluralize("rig", pairs)}
        </ChainAwareButton>
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

interface NFTDisplayProps {
  nft: NFT;
  onSelect: () => void;
  selected: boolean;
  supported: boolean;
}

const NFTDisplay = ({
  nft,
  onSelect,
  selected,
  supported,
}: NFTDisplayProps) => {
  const size = { base: "150px", md: "200px" };
  return (
    <Box
      width={size}
      position="relative"
      onClick={() => onSelect()}
      _hover={{ cursor: supported ? "pointer" : "not-allowed" }}
    >
      <Image
        src={nft.imageUrl || nft.imageData}
        fallbackSrc={unknownPilot}
        width={size}
        sx={{ aspectRatio: "1/1", objectFit: "contain" }}
      />
      {supported && (
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          height={size}
          _hover={{ backgroundColor: "rgba(0,0,0,0.15)" }}
          transition=".2s"
        />
      )}
      {!supported && (
        <Flex
          position="absolute"
          top="0"
          left="0"
          right="0"
          height={size}
          backgroundColor={"rgba(0,0,0,0.35)"}
          align="center"
          justify="center"
          zIndex="3"
        >
          <NotAllowedIcon color="#aaa" fontSize="60px" />
        </Flex>
      )}
      {selected && (
        <Box position="absolute" top={1} right={1}>
          <CheckCircleIcon color="white" fontSize="25px" />
        </Box>
      )}
      <Text noOfLines={1}>{nft.name}</Text>
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

const searchCollections = (
  inputValue: string,
  callback: (data: Collection[]) => void
) => {
  alchemy.nft
    .searchContractMetadata(inputValue)
    .then((v) =>
      callback(
        v.map(toCollection).map((v) => ({ ...v, value: v.contractAddress }))
      )
    );
};

const debouncedSearchCollections = debounce(searchCollections, 400);

const components = {
  DropdownIndicator: (props: DropdownIndicatorProps<Collection>) => (
    <chakraComponents.DropdownIndicator {...props}>
      <SearchIcon />
    </chakraComponents.DropdownIndicator>
  ),
};

const usePagination = () => {
  const [pagination, setPagination] = useState<{
    index: number;
    pages: string[];
  }>({
    index: 0,
    pages: [""],
  });

  const reset = useCallback(() => {
    setPagination({ index: 0, pages: [""] });
  }, [setPagination]);

  const gotoPrevious = useCallback(() => {
    setPagination((old) => {
      if (old.index < 1) return old;

      return { ...old, index: old.index - 1 };
    });
  }, [setPagination]);

  const gotoNext = useCallback(
    (nextPageKey?: string) => {
      setPagination((old) => {
        if (old.index === old.pages.length - 1 && nextPageKey) {
          return {
            index: old.index + 1,
            pages: old.pages.concat([nextPageKey]),
          };
        } else {
          return { ...old, index: old.index + 1 };
        }
      });
    },
    [setPagination]
  );

  return { pagination, reset, gotoPrevious, gotoNext };
};

const useFilters = <T,>() => {
  const [filters, setFilters] = useState<Set<T>>(new Set());
  const toggleFilter = useCallback(
    (value: T) => {
      setFilters((old) => toggleInSet(copySet(old), value));
    },
    [setFilters]
  );
  const clearFilters = useCallback(() => {
    setFilters(new Set());
  }, [setFilters]);

  return { filters, toggleFilter, clearFilters };
};

// The pilot contract packs pilot struct data and requires that the pilot token id
// is < type(uint32).max
const MAX_SUPPORTED_PILOT_TOKEN_ID = ethers.BigNumber.from("0xFFFFFFFF");

const tryParseBigNumber = (v: any) => {
  try {
    return { valid: true, result: ethers.BigNumber.from(v) };
  } catch (_) {
    return { valid: false, result: ethers.BigNumber.from(0) };
  }
};

const PickRigPilotStep = ({
  rigs,
  pilots,
  setPilot,
  onNext,
  onClose,
}: PickRigPilotStepProps) => {
  const { actingAsAddress } = useAccount();
  const { filters, toggleFilter, clearFilters } = useFilters<Collection>();
  const ownedNftsFilter = useMemo(() => {
    return {
      contracts: Array.from(filters).map((v) => v.contractAddress),
    };
  }, [filters]);

  const { pagination, reset, gotoNext, gotoPrevious } = usePagination();
  useEffect(() => {
    reset();
  }, [ownedNftsFilter]);

  const { data, isFetching } = useOwnedNFTs(
    actingAsAddress,
    20,
    pagination.pages[pagination.index],
    ownedNftsFilter
  );
  const nfts = data?.nfts;

  const [currentRig, setCurrentRig] = useState(0);
  const rig = useMemo(() => rigs[currentRig], [rigs, currentRig]);
  const pilot = useMemo(
    () => pilots[rigs[currentRig].id],
    [pilots, rigs, currentRig]
  );

  const next = useCallback(() => {
    setCurrentRig((old) => {
      if (old === rigs.length - 1) return old;

      return old + 1;
    });
  }, [setCurrentRig, rigs]);

  const prev = useCallback(() => {
    setCurrentRig((old) => {
      if (old === 0) return old;

      return old - 1;
    });
  }, [setCurrentRig, rigs]);

  const displayArrows = useMemo(() => {
    return rigs.length > 1;
  }, [rigs]);

  return (
    <>
      <ModalBody>
        <Text mb={4}>
          Trained Rigs can use any ERC721 token that you own as their pilot.
          Select custom pilots for the Rigs you've selected below, or click the
          Pilot Rigs button to use the default trainer pilot.
        </Text>
        <Flex direction="column">
          <Flex justify="center" align="center" width="100%">
            {displayArrows && (
              <Button
                leftIcon={<ArrowBackIcon />}
                onClick={prev}
                isDisabled={currentRig === 0}
                mr={4}
              >
                Prev
              </Button>
            )}
            <Flex direction="column" p={4}>
              <RigDisplay
                rig={rig}
                pilotNFT={pilot}
                width={{ base: "150px", md: "260px" }}
              />
              Preview
            </Flex>
            {displayArrows && (
              <Button
                leftIcon={<ArrowForwardIcon />}
                onClick={next}
                isDisabled={currentRig === rigs.length - 1}
                ml={4}
              >
                Next
              </Button>
            )}
          </Flex>
        </Flex>
        <Box my={4}>
          <AsyncSelect
            name="collection"
            placeholder="Filter by collection"
            components={components}
            controlShouldRenderValue={false}
            loadOptions={debouncedSearchCollections}
            chakraStyles={{ menu: (base) => ({ ...base, zIndex: 10 }) }}
            formatOptionLabel={(v: Collection) => {
              return (
                <Flex onClick={() => toggleFilter(v)} align="center">
                  <Image src={v.imageUrl} width="30px" mr={2} /> {v.name}
                </Flex>
              );
            }}
          />
        </Box>
        {filters.size > 0 && (
          <Flex direction="row" wrap="wrap" gap={4} my={4} align="center">
            <Text>Filters:</Text>
            {Array.from(filters).map((collection, index) => {
              const { name } = collection;
              return (
                <Tag
                  color="primary"
                  py={2}
                  key={`collection-filter-${name}-${index}`}
                >
                  {name}
                  <TagCloseButton onClick={() => toggleFilter(collection)} />
                </Tag>
              );
            })}
            <Button variant="ghost" onClick={clearFilters}>
              Clear all
            </Button>
          </Flex>
        )}
        <Flex direction="row" wrap="wrap" justify="start" gap={4}>
          {nfts &&
            nfts.map((nft, index) => {
              const { valid, result: tokenId } = tryParseBigNumber(nft.tokenId);
              const supported =
                nft.type === "ERC721" &&
                nft.contract.toLowerCase() !== contractAddress.toLowerCase() &&
                !!(nft.imageData || nft.imageUrl || nft.highResImageUrl) &&
                valid &&
                MAX_SUPPORTED_PILOT_TOKEN_ID.gte(tokenId);

              const alreadySelected = Object.values(pilots).includes(nft);

              const selectedForCurrentRig = pilot === nft;
              const supportedForCurrentRig =
                supported && (!alreadySelected || selectedForCurrentRig);

              return (
                <NFTDisplay
                  key={`nft-list-${index}`}
                  nft={nft}
                  onSelect={() =>
                    supportedForCurrentRig && setPilot(nft, rig.id)
                  }
                  selected={selectedForCurrentRig}
                  supported={supportedForCurrentRig}
                />
              );
            })}
          {isFetching && (
            <Flex justify="center" align="center" p={8} width="100%">
              <Spinner />
            </Flex>
          )}
        </Flex>
        <Flex gap={4} mt={2}>
          <Button onClick={gotoPrevious} disabled={pagination.index === 0}>
            Previous Page
          </Button>
          <Button
            onClick={() => gotoNext(data?.pageKey)}
            disabled={!data?.hasMore}
          >
            Next Page
          </Button>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button mr={3} onClick={onNext} isDisabled={rigs.length === 0}>
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
        let update = { ...old };
        if (update[rigId] === pilot) delete update[rigId];
        else update[rigId] = pilot;
        return update;
      });
    },
    [setPilots]
  );

  const [step, setStep] = useState<"pick" | "confirm">("pick");

  const pairs = useMemo(() => {
    return rigs.map((rig) => ({ rig, pilot: pilots[rig.id] }));
  }, [rigs, pilots]);

  // Effect that resets the state when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      setPilots({});
      setStep("pick");
    }
  }, [isOpen, setPilots, setStep]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Choose Pilot</ModalHeader>
        <ModalCloseButton />
        {step === "pick" && (
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
