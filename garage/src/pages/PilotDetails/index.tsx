import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Link,
  Show,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useBreakpointValue,
  VStack,
} from "@chakra-ui/react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { useAccount, useBlockNumber, useContractRead, useEnsName } from "wagmi";
import { RoundSvgIcon } from "../../components/RoundSvgIcon";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { useNFTs, NFT } from "../../hooks/useNFTs";
import { useRigImageUrls } from "../../hooks/useRigImageUrls";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { mainChain, openseaBaseUrl } from "../../env";
import { PilotSessionWithRigId } from "../../types";
import { ReactComponent as OpenseaMark } from "../../assets/opensea-mark.svg";
import { selectPilotSessionsForPilot } from "../../utils/queries";
import { isValidAddress, as0xString } from "../../utils/types";
import { abi } from "../../abis/ERC721";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

type NFTHeaderProps = React.ComponentProps<typeof Box> & {
  nft: NFT;
  owner?: string;
  userOwnsNFT: boolean;
  events: PilotSessionWithRigId[];
  currentBlockNumber: number;
};

const NFTHeader = ({
  nft,
  owner,
  userOwnsNFT,
  refresh,
  events,
  currentBlockNumber,
  ...props
}: NFTHeaderProps) => {
  const shouldTruncate = useBreakpointValue({
    base: true,
    sm: false,
  });

  const { data: ens } = useEnsName({
    address: isValidAddress(owner) ? owner : undefined,
  });

  const truncatedOwner = owner ? truncateWalletAddress(owner) : "";

  const totalFt = events.reduce((acc, { startTime, endTime }) => {
    return acc + ((endTime ?? currentBlockNumber) - startTime);
  }, 0);

  return (
    <>
      <Box {...props}>
        <HStack justify="space-between" align="baseline" sx={{ width: "100%" }}>
          <Heading size="xl">{nft.name}</Heading>
          <HStack>
            <Link
              href={`${openseaBaseUrl}/${nft.contract}/${nft.tokenId}`}
              title={`View ${nft.name} on OpenSea`}
              isExternal
            >
              <RoundSvgIcon Component={OpenseaMark} size={20} />
            </Link>
          </HStack>
        </HStack>
        <Heading size="sm">Total FT earned: {prettyNumber(totalFt)}</Heading>
        <HStack pt={8} justify="space-between">
          <Text>
            Owned by{" "}
            <RouterLink to={`/owner/${owner}`} style={{ fontWeight: "bold" }}>
              {userOwnsNFT
                ? "You"
                : ens ?? (shouldTruncate ? truncatedOwner : owner)}
            </RouterLink>
          </Text>
        </HStack>
      </Box>
    </>
  );
};

const NFTDisplay = ({ nft }: { nft: NFT }) => {
  const { highResImageUrl, imageUrl, imageData } = nft;

  return (
    <Image
      src={highResImageUrl || imageUrl || imageData}
      objectFit="contain"
      width="100%"
    />
  );
};

type FlightLogProps = React.ComponentProps<typeof Box> & {
  pilot: NFT;
  events: PilotSessionWithRigId[];
  currentBlockNumber: number;
};

const FlightLog = ({
  pilot,
  events,
  currentBlockNumber,
  p,
  ...props
}: FlightLogProps) => {
  return (
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Flight log</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} colSpan={2}>
              Rig
            </Th>
            <Th isNumeric>
              <Show above="sm">Flight time (FT)</Show>
              <Show below="sm">FT</Show>
            </Th>
            <Th pr={p}>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {events.map(({ rigId, thumb, startTime, endTime }, index) => {
            const { thumb: thumbUrl } = useRigImageUrls({ id: rigId, thumb });
            const ft = (endTime ?? currentBlockNumber) - startTime;

            return (
              <Tr key={`flight-log-${index}`}>
                <Td
                  pl={p}
                  pr={0}
                  width={`calc(var(--chakra-sizes-${p}) + 20px)`}
                >
                  <RouterLink to={`/rigs/${rigId}`}>
                    <Image
                      src={thumbUrl}
                      alt={`Rig ${rigId}`}
                      sx={{ width: "20px", height: "20px", maxWidth: "20px" }}
                    />
                  </RouterLink>
                </Td>
                <Td width="60px">
                  <RouterLink to={`/rigs/${rigId}`}>{`#${rigId}`}</RouterLink>
                </Td>
                <Td isNumeric>{prettyNumber(ft)}</Td>
                <Td color={endTime ? "inactive" : "inherit"}>
                  {!endTime ? " In-flight" : "Ended"}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      {events.length === 0 && (
        <Text p={p} variant="emptyState">
          This NFT has not piloted a Rig yet.
        </Text>
      )}
    </VStack>
  );
};

export const PilotDetails = () => {
  const { collection, id } = useParams();

  const param = useMemo(() => {
    if (!collection || !id) return [];

    return [{ contract: collection, tokenId: id }];
  }, [collection, id]);

  const { nfts } = useNFTs(param);
  const pilot = nfts?.length ? nfts[0] : null;

  const { data: owner } = useContractRead({
    chainId: mainChain.id,
    address: as0xString(collection),
    abi,
    functionName: "ownerOf",
    args: [BigInt(id ?? "")],
  });

  const { address } = useAccount();

  const { db } = useTablelandConnection();
  const [events, setEvents] = useState<PilotSessionWithRigId[]>();

  useEffect(() => {
    if (!collection || !id) return;

    db.prepare(selectPilotSessionsForPilot(collection, id))
      .all<PilotSessionWithRigId>()
      .then(({ results }) => {
        if (results) setEvents(results);
      });
  }, [db, collection, id]);

  const userOwnsNFT = useMemo(() => {
    return !!address && address.toLowerCase() === owner?.toLowerCase();
  }, [address, owner]);

  const { data: currentBlockNumber } = useBlockNumber();

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
        {pilot && events && Number(currentBlockNumber) && (
          <>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Show below="md">
                  <NFTHeader
                    {...MODULE_PROPS}
                    nft={pilot}
                    owner={owner}
                    userOwnsNFT={userOwnsNFT}
                    events={events}
                    currentBlockNumber={Number(currentBlockNumber)}
                  />
                </Show>
                <Box p={4} bgColor="paper" borderRadius="3px" flexGrow="1">
                  <NFTDisplay nft={pilot} />
                </Box>
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Show above="md">
                  <NFTHeader
                    {...MODULE_PROPS}
                    nft={pilot}
                    owner={owner}
                    userOwnsNFT={userOwnsNFT}
                    events={events}
                    currentBlockNumber={Number(currentBlockNumber)}
                  />
                </Show>
                <FlightLog
                  pilot={pilot}
                  events={events}
                  currentBlockNumber={Number(currentBlockNumber)}
                  {...MODULE_PROPS}
                />
              </VStack>
            </GridItem>
          </>
        )}
      </Grid>
      {!pilot && <Spinner />}
    </Flex>
  );
};
