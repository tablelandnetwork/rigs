import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import styled from "@emotion/styled";
import {
  Box,
  Flex,
  Heading,
  Image,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
} from "@chakra-ui/react";
import { EventAction } from "../../../types";
import { useRigImageUrls } from "../../../hooks/useRigImageUrls";
import { useRigsActivity } from "../../../hooks/useRigsActivity";
import { useNFTCollections } from "../../../hooks/useNFTs";

const getPilotedTitle = (
  lookups: Record<string, string>,
  contract: string,
  tokenId: string
) => {
  const collectionName = lookups[contract.toLowerCase()] || contract;

  return `Piloted ${collectionName} #${tokenId}`;
};

export const Activity = (props: React.ComponentProps<typeof Box>) => {
  const { events } = useRigsActivity();
  const { p = "8px", ...otherProps } = props;

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
    <Flex
      direction="column"
      pt={p}
      sx={{ height: "100%", minWidth: { xl: "400px" } }}
      {...otherProps}
    >
      <Heading px={p}>Activity</Heading>
      {!events && (
        <Flex align="center" justify="center">
          <Spinner m={p} size="md" />
        </Flex>
      )}
      <Table>
        <Tbody>
          {events &&
            events.map(({ rigId, thumb, action, pilot }, index) => {
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
                <Tr key={`activity-row-${index}`}>
                  <Td
                    pl={p}
                    pr={0}
                    width={`calc(var(--chakra-sizes-${p}) + 20px)`}
                  >
                    <Link to={`/rigs/${rigId}`}>
                      <Image
                        src={thumbUrl}
                        alt={`Rig ${rigId}`}
                        sx={{ width: "20px", height: "20px", maxWidth: "20px" }}
                      />
                    </Link>
                  </Td>
                  <Td width="60px">
                    <Link to={`/rigs/${rigId}`}>{`#${rigId}`}</Link>
                  </Td>
                  <Td
                    pr={p}
                    sx={{
                      maxWidth: { base: "200px", md: "300px" },
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                    isNumeric
                  >
                    {title}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
      {events && events.length === 0 && (
        <Text p={p} variant="emptyState">
          No activity yet.
        </Text>
      )}
    </Flex>
  );
};
