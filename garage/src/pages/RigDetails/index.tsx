import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Show,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Thead,
  Th,
  Tr,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { ArrowForwardIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { useParams, Link as RouterLink } from "react-router-dom";
import { useBlockNumber, useContractReads, useEnsName } from "wagmi";
import { useAccount } from "../../hooks/useAccount";
import { useGlobalFlyParkModals } from "../../components/GlobalFlyParkModals";
import { ChainAwareButton } from "../../components/ChainAwareButton";
import { RoundSvgIcon } from "../../components/RoundSvgIcon";
import { TransferRigModal } from "../../components/TransferRigModal";
import { useNFTsCached } from "../../components/NFTsContext";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigDisplay } from "../../components/RigDisplay";
import { FlightLog } from "./modules/FlightLog";
import { Pilots } from "./modules/Pilots";
import { RigAttributes } from "./modules/RigAttributes";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { useRig } from "../../hooks/useRig";
import { findNFT } from "../../utils/nfts";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { sleep } from "../../utils/async";
import { isValidAddress, as0xString } from "../../utils/types";
import { chain, openseaBaseUrl, deployment } from "../../env";
import { RigWithPilots } from "../../types";
import { abi } from "../../abis/TablelandRigs";
import { ReactComponent as OpenseaMark } from "../../assets/opensea-mark.svg";
import { ReactComponent as TablelandMark } from "../../assets/tableland.svg";
import { ReactComponent as FilecoinMark } from "../../assets/filecoin-mark.svg";

const { contractAddress } = deployment;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

type RigHeaderProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  tokenURI?: string;
  owner?: string;
  userOwnsRig?: boolean;
  currentBlockNumber?: number;
  refresh: () => void;
};

const RigHeader = ({
  rig,
  tokenURI,
  owner,
  userOwnsRig,
  currentBlockNumber,
  refresh,
  ...props
}: RigHeaderProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const {
    isOpen: filecoinDealsIsOpen,
    onOpen: onOpenFilecoinDeals,
    onClose: onCloseFilecoinDeals,
  } = useDisclosure();

  const { address, actingAsAddress } = useAccount();

  const rigWithFilecoinDeals = useMemo(() => {
    if (rig && rig.filecoinDeals) return rig as RigWithFilecoinDeals;
  }, [rig]);

  const totalFlightTime = rig.pilotSessions.reduce(
    (acc, { startTime, endTime }) => {
      return (
        acc +
        Math.max((endTime ?? currentBlockNumber ?? startTime) - startTime, 0)
      );
    },
    0
  );

  const shouldTruncate = useBreakpointValue({
    base: true,
    sm: false,
  });

  const { data: ens } = useEnsName({
    address: isValidAddress(owner) ? owner : undefined,
  });

  const truncatedOwner = owner ? truncateWalletAddress(owner) : "";

  return (
    <>
      <TransferRigModal
        rig={rig}
        isOpen={isOpen}
        onClose={onClose}
        onTransactionCompleted={refresh}
      />
      {rigWithFilecoinDeals && (
        <FilecoinDealsModal
          rig={rigWithFilecoinDeals}
          isOpen={filecoinDealsIsOpen}
          onClose={onCloseFilecoinDeals}
        />
      )}
      <Box {...props}>
        <HStack justify="space-between" align="baseline" sx={{ width: "100%" }}>
          <Heading size="xl">Rig {`#${rig.id}`}</Heading>

          <HStack>
            <Link
              href={`${openseaBaseUrl}/${contractAddress}/${rig.id}`}
              title={`View Rig #${rig.id} on OpenSea`}
              isExternal
            >
              <RoundSvgIcon size={20} Component={OpenseaMark} />
            </Link>

            <Link
              href={tokenURI}
              title={`View raw metadata for Rig #${rig.id}`}
              isExternal
            >
              <RoundSvgIcon size={20} Component={TablelandMark} />
            </Link>

            <Link
              onClick={onOpenFilecoinDeals}
              title={`View filecoin deal for Rig #${rig.id}`}
              isExternal
            >
              <RoundSvgIcon size={20} Component={FilecoinMark} />
            </Link>
          </HStack>
        </HStack>
        <Heading size="sm">
          {rig.currentPilot ? "In-flight" : "Parked"}
          {` (${prettyNumber(totalFlightTime)} FT)`}
        </Heading>
        <HStack pt={8} justify="space-between">
          <Text>
            Owned by{" "}
            <RouterLink to={`/owner/${owner}`} style={{ fontWeight: "bold" }}>
              {userOwnsRig
                ? "You"
                : ens ?? (shouldTruncate ? truncatedOwner : owner)}
            </RouterLink>
          </Text>

          {userOwnsRig && address === actingAsAddress && (
            <ChainAwareButton
              variant="solid"
              color="primary"
              size="sm"
              onClick={onOpen}
              leftIcon={<ArrowForwardIcon />}
            >
              Transfer
            </ChainAwareButton>
          )}
        </HStack>
      </Box>
    </>
  );
};

type RigWithFilecoinDeals = RigWithPilots &
  Required<Pick<RigWithPilots, "filecoinDeals">>;

interface FilecoinDealsModalProps {
  rig: RigWithFilecoinDeals;
  isOpen: boolean;
  onClose: () => void;
}

const FilecoinDealsModal = ({
  rig,
  isOpen,
  onClose,
}: FilecoinDealsModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Filecoin Deal Information</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={4}>
            This rig's image data is stored on filecoin in multiple deals:
          </Text>
          <Table>
            <Thead>
              <Tr>
                <Th>Deal ID</Th>
                <Th>Deal Selector</Th>
                <Th>Deal link</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rig.filecoinDeals.map(({ dealId, selector }) => (
                <Tr key={`deal-${dealId}`}>
                  <Td>{dealId}</Td>
                  <Td>{selector}</Td>
                  <Td isNumeric>
                    <Link
                      href={`https://filfox.info/deal/${dealId}`}
                      isExternal
                    >
                      Filfox
                      <ExternalLinkIcon ml={2} mb={1} />
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export const RigDetails = () => {
  const { id } = useParams();
  const { actingAsAddress } = useAccount();
  const { data: currentBlockNumber } = useBlockNumber();
  const { rig, refresh: refreshRig } = useRig(id || "");
  const { validator } = useTablelandConnection();

  const { data: contractData, refetch } = useContractReads({
    allowFailure: false,
    contracts: [
      {
        address: as0xString(contractAddress)!,
        abi,
        functionName: "ownerOf",
        args: [BigInt(id ?? "")],
      },
      {
        address: as0xString(contractAddress)!,
        abi,
        functionName: "tokenURI",
        args: [BigInt(id ?? "")],
      },
      {
        address: as0xString(contractAddress)!,
        abi,
        functionName: "pilotInfo",
        args: [BigInt(id ?? "")],
      },
    ],
  });

  const [owner, tokenURI, pilotInfo] = contractData ?? [];

  const pilots = useMemo(() => {
    return rig?.pilotSessions.filter((v) => v.contract);
  }, [rig]);
  const { nfts } = useNFTsCached(pilots);

  const refresh = useCallback(() => {
    refreshRig();
    refetch();
  }, [refreshRig, refetch]);

  const userOwnsRig = useMemo(() => {
    return (
      !!actingAsAddress &&
      actingAsAddress.toLowerCase() === owner?.toLowerCase()
    );
  }, [actingAsAddress, owner]);

  const [pendingTx, setPendingTx] = useState<string>();
  const clearPendingTx = useCallback(() => {
    setPendingTx(undefined);
  }, [setPendingTx]);

  const refreshRigAndClearPendingTx = useCallback(() => {
    refresh();
    sleep(500).then((_) => setPendingTx(undefined));
  }, [refresh, setPendingTx]);

  // Effect that waits until a tableland receipt is available for a tx hash
  // and then refreshes the rig data
  useEffect(() => {
    if (validator && pendingTx) {
      const controller = new AbortController();
      const signal = controller.signal;

      validator
        .pollForReceiptByTransactionHash(
          {
            chainId: chain.id,
            transactionHash: pendingTx,
          },
          { interval: 2000, signal }
        )
        .then((_) => {
          refreshRigAndClearPendingTx();
        })
        .catch((_) => {
          clearPendingTx();
        });

      return () => {
        controller.abort();
      };
    }
  }, [pendingTx, refreshRigAndClearPendingTx, validator, clearPendingTx]);

  const currentNFT =
    rig?.currentPilot && nfts && findNFT(rig.currentPilot, nfts);

  const { trainRigsModal, pilotRigsModal, parkRigsModal } =
    useGlobalFlyParkModals();

  const onOpenTrainModal = useCallback(() => {
    if (rig) trainRigsModal.openModal([rig], setPendingTx);
  }, [rig, setPendingTx]);

  const onOpenPilotModal = useCallback(() => {
    if (rig) pilotRigsModal.openModal([rig], setPendingTx);
  }, [rig, setPendingTx]);

  const onOpenParkModal = useCallback(() => {
    if (rig) parkRigsModal.openModal([rig], setPendingTx);
  }, [rig, setPendingTx]);

  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
    >
      <Grid
        templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(2, 1fr)" }}
        p={GRID_GAP}
        pt={{ base: GRID_GAP, md: GRID_GAP * 2 }}
        gap={GRID_GAP}
        maxWidth="1385px"
        width="100%"
        height="100%"
      >
        {rig && nfts && (
          <>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Show below="md">
                  <RigHeader
                    {...MODULE_PROPS}
                    rig={rig}
                    owner={owner}
                    tokenURI={tokenURI}
                    userOwnsRig={userOwnsRig}
                    currentBlockNumber={Number(currentBlockNumber)}
                    refresh={refresh}
                  />
                </Show>
                <Box p={4} bgColor="paper" borderRadius="3px">
                  <RigDisplay
                    border={1}
                    borderStyle="solid"
                    borderColor="black"
                    borderRadius="3px"
                    rig={rig}
                    pilotNFT={currentNFT}
                    loading={!!pendingTx}
                    pilotBorderWidth="3px"
                  />
                </Box>
                <RigAttributes rig={rig} {...MODULE_PROPS} />
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Show above="md">
                  <RigHeader
                    {...MODULE_PROPS}
                    rig={rig}
                    owner={owner}
                    tokenURI={tokenURI}
                    userOwnsRig={userOwnsRig}
                    currentBlockNumber={Number(currentBlockNumber)}
                    refresh={refresh}
                  />
                </Show>
                <Pilots
                  rig={rig}
                  nfts={nfts}
                  isOwner={userOwnsRig}
                  onOpenParkModal={onOpenParkModal}
                  onOpenPilotModal={onOpenPilotModal}
                  onOpenTrainModal={onOpenTrainModal}
                  chainPilotStatus={pilotInfo?.status}
                  {...MODULE_PROPS}
                />
                <FlightLog rig={rig} nfts={nfts} {...MODULE_PROPS} />
              </VStack>
            </GridItem>
          </>
        )}
      </Grid>
      {!rig && <Spinner />}
    </Flex>
  );
};
