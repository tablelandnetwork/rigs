import React, { useMemo } from "react";
import {
  Box,
  Flex,
  Heading,
  Image,
  Spinner,
  Table,
  Tbody,
  Text,
  Tr,
  Td,
  VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useRigImageUrls } from "../../../hooks/useRigImageUrls";
import { useNFTCollections } from "../../../hooks/useNFTs";
import { Event, EventAction } from "../../../types";

interface ActivityLogProps extends React.ComponentProps<typeof Box> {
  events?: Event[];
}

const getPilotedTitle = (
  lookups: Record<string, string>,
  contract: string,
  tokenId: string
) => {
  const collectionName = lookups[contract.toLowerCase()] || contract;

  return `Piloted ${collectionName} #${tokenId}`;
};

export const ActivityLog = ({ events, p, ...props }: ActivityLogProps) => {
  // TODO add table header? might look nicer since the pilots table has one

  const contracts = useMemo(() => {
    return Array.from(
      new Set(
        events
          ?.filter((v) => v.pilot)
          .map((v) => v.pilot?.contract)
          .filter((v) => v) as string[]
      )
    );
  }, [events]);
  const { collections } = useNFTCollections(contracts);
  const collectionNameLookup = useMemo(() => {
    return Object.fromEntries(
      collections?.map((v) => [v.contractAddress.toLowerCase(), v.name]) || []
    );
  }, [collections]);

  return (
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Activity</Heading>
      <Table>
        <Tbody>
          {events &&
            events.map(({ action, rigId, thumb, pilot }, index) => {
              const { thumb: thumbUrl } = useRigImageUrls({ id: rigId, thumb });

              const title =
                pilot && action === EventAction.Piloted
                  ? getPilotedTitle(
                      collectionNameLookup,
                      pilot.contract,
                      pilot.tokenId
                    )
                  : action;
              return (
                <Tr key={`flight-log-${index}`}>
                  <Td
                    pl={p}
                    pr={0}
                    width={`calc(var(--chakra-sizes-${p}) + 30px)`}
                  >
                    <Image
                      src={thumbUrl}
                      alt={`Rig ${rigId}`}
                      sx={{ width: "30px", height: "30px", maxWidth: "30px" }}
                    />
                  </Td>
                  <Td>
                    <Link to={`/rigs/${rigId}`}>#{rigId}</Link>
                  </Td>
                  <Td pr={p} isNumeric>
                    {title}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
      {!events && (
        <Flex p={p} justify="center">
          <Spinner />
        </Flex>
      )}
      {events?.length === 0 && (
        <Text p={p} variant="emptyState">
          This wallet has no Rigs activity yet.
        </Text>
      )}
    </VStack>
  );
};
