import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Heading,
  Flex,
  GridItem,
  VStack,
  Image,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  Table,
  Thead,
  Tbody,
  Th,
  Tr,
  Td,
  Tabs,
  TabList,
  TabPanel,
  TabPanels,
  Text,
  useBreakpointValue,
  Show,
} from "@chakra-ui/react";
import { usePublicClient } from "wagmi";
import { useAccount } from "~/hooks/useAccount";
import {
  useAccountStats,
  useStats,
  useTopActivePilotCollections,
  useTopFtPilotCollections,
  useFtLeaderboard,
  Stat,
} from "~/hooks/useRigStats";
import { useNFTCollections, Collection } from "~/hooks/useNFTs";
import { prettyNumber, truncateWalletAddress } from "~/utils/fmt";
import { isValidAddress } from "~/utils/types";
import { mainChain } from "~/env";

const StatItem = ({ name, value }: { name: string; value: number }) => {
  return (
    <Stack p={3} borderRadius="3px">
      <Text noOfLines={1}>{name}</Text>
      <Flex align="center" justify="center">
        <Text
          fontSize="4xl"
          py={8}
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={prettyNumber(value)}
        >
          {prettyNumber(value)}
        </Text>
      </Flex>
    </Stack>
  );
};

const StatGrid = ({ stats }: { stats?: Stat[] }) => {
  return (
    <SimpleGrid minChildWidth="260px" gap={3}>
      {stats &&
        stats.map(({ name, value }) => {
          return (
            <GridItem key={name} bgColor="block">
              <StatItem name={name} value={value} />
            </GridItem>
          );
        })}
      {!stats && (
        <Flex justify="center">
          <Spinner />
        </Flex>
      )}
    </SimpleGrid>
  );
};

const CollectionToplist = ({
  stat,
  data,
}: {
  stat: string;
  data: { collection: Collection; stat: string | number }[];
}) => {
  return (
    <Table>
      <Thead>
        <Tr>
          <Th colSpan={2}>Collection</Th>
          <Th isNumeric>{stat}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {data?.slice(0, 10).map(({ collection, stat }, index) => {
          return (
            <Tr key={`pilot-${index}`}>
              <Td width="30px" px={0}>
                <Image src={collection?.imageUrl} width="30px" height="30px" />
              </Td>
              <Td>{collection?.name}</Td>
              <Td isNumeric>{stat}</Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

const FTLeaderboard = ({
  data,
}: {
  data: { address: string; ft: number }[];
}) => {
  const publicClient = usePublicClient({ chainId: mainChain.id });

  const [ensNames, setEnsNames] = useState<Record<string, string>>({});

  // Effect that reverse-resolves address->ens for all FT leaderboard entries
  // in one batch multicall request
  useEffect(() => {
    let isCancelled = false;
    if (data.length > 0) {
      Promise.all(
        data
          .map(({ address }) => address)
          .filter(isValidAddress)
          .map(async (address) => {
            const ens = await publicClient.getEnsName({ address });
            return [address, ens];
          })
      ).then((v) => {
        if (!isCancelled)
          setEnsNames(Object.fromEntries(v.filter(([, ens]) => ens)));
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [data]);

  const { actingAsAddress } = useAccount();

  const shouldTruncate = useBreakpointValue({
    base: true,
    md: false,
  });

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Address</Th>
          <Th isNumeric>FT</Th>
        </Tr>
      </Thead>
      <Tbody>
        {data?.slice(0, 15).map(({ address, ft }, index) => {
          const isUser =
            !!actingAsAddress &&
            actingAsAddress.toLowerCase() === address?.toLowerCase();

          const truncatedAddress = address
            ? truncateWalletAddress(address)
            : "";
          const name = isUser
            ? "You"
            : ensNames[address] ??
              (shouldTruncate ? truncatedAddress : address);

          return (
            <Tr key={`pilot-${index}`}>
              <Td>
                <RouterLink to={`/owner/${address}`}>{name}</RouterLink>
              </Td>
              <Td isNumeric>{prettyNumber(ft)}</Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export const Stats = (props: React.ComponentProps<typeof Box>) => {
  const { actingAsAddress } = useAccount();
  const { stats } = useStats();
  const { stats: accountStats } = useAccountStats(actingAsAddress);
  const { stats: pilotStats } = useTopActivePilotCollections();
  const { stats: ftStats } = useTopFtPilotCollections();
  const { stats: ftLeaderboard } = useFtLeaderboard(15);

  const contracts = useMemo(() => {
    if (!pilotStats || !ftStats) return;

    return Array.from(
      new Set([
        ...pilotStats?.slice(0, 10).map((v) => v.contractAddress),
        ...ftStats?.slice(0, 10).map((v) => v.contractAddress),
      ])
    );
  }, [pilotStats, ftStats]);
  const { collections } = useNFTCollections(contracts);
  const collectionLookup = useMemo(() => {
    return Object.fromEntries(
      collections?.map((v) => [v.contractAddress.toLowerCase(), v]) || []
    );
  }, [collections]);

  return (
    <Flex direction="column" sx={{ height: "100%" }} {...props}>
      <Heading mb={4}>Stats</Heading>
      <Tabs variant="line">
        <TabList>
          <Tab>Global</Tab>
          {actingAsAddress && <Tab>You</Tab>}
          <Tab>Pilots</Tab>
          <Tab>
            <Show above="sm">FT Leaderboard</Show>
            <Show below="sm">FT</Show>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <StatGrid stats={stats} />
          </TabPanel>
          {actingAsAddress && (
            <TabPanel px={0}>
              <StatGrid stats={accountStats} />
            </TabPanel>
          )}
          <TabPanel fontSize="0.8em" px={0}>
            <Flex
              width="100%"
              gap={8}
              pt={2}
              direction={{ base: "column", md: "row" }}
            >
              <VStack flexGrow="1" align="start">
                <Heading>Top collections</Heading>
                {pilotStats && (
                  <CollectionToplist
                    stat="Num. pilots"
                    data={pilotStats
                      .slice(0, 10)
                      .map(({ contractAddress, count }) => {
                        const collection = collectionLookup[contractAddress];
                        return { collection, stat: count };
                      })}
                  />
                )}
              </VStack>
              <VStack flexGrow="1" align="start">
                <Heading>Most FT earned</Heading>
                {ftStats && (
                  <CollectionToplist
                    stat="FT"
                    data={ftStats
                      .slice(0, 10)
                      .map(({ contractAddress, ft }) => {
                        const collection = collectionLookup[contractAddress];
                        return { collection, stat: prettyNumber(ft) };
                      })}
                  />
                )}
              </VStack>
            </Flex>
          </TabPanel>
          <TabPanel fontSize="0.8em" px={0}>
            <VStack flexGrow="1" pt={2} align="start">
              <Heading>Top FT earners</Heading>
              {ftLeaderboard && <FTLeaderboard data={ftLeaderboard} />}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>
  );
};
