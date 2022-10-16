import React from "react";
import {
  Box,
  Heading,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { RigWithPilots } from "../../../types";
import { NFT } from "../../../hooks/useNFTs";
import { findNFT } from "../../../utils/nfts";

type FlightLogProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  nfts: NFT[];
};

export const FlightLog = ({ rig, nfts, p, ...props }: FlightLogProps) => {
  const events = rig.pilotSessions
    .flatMap(({ startTime, endTime, owner, contract, tokenId }) => {
      const { name = "Trainer" } = findNFT({ tokenId, contract }, nfts) || {};

      let events = [{ type: `Piloted ${name}`, timestamp: startTime, owner }];

      if (endTime) {
        events = [...events, { type: "Parked", timestamp: endTime, owner }];
      }

      return events;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Flight log</Heading>
      <Table>
        <Tbody>
          {events.map(({ type, owner }, index) => {
            return (
              <Tr key={`flight-log-${index}`}>
                <Td pl={p}>{type}</Td>
                <Td pr={p} isNumeric>
                  {owner}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      {events.length === 0 && (
        <Text p={p} variant="emptyState">
          This Rig has never left the garage.
        </Text>
      )}
    </VStack>
  );
};
