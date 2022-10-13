import React from "react";
import {
  Box,
  Heading,
  Spinner,
  Table,
  Tbody,
  Td,
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
    .flatMap(({ startTime, endTime, contract, tokenId }) => {
      const { name = "Trainer" } = findNFT({ tokenId, contract }, nfts) || {};

      let events = [{ type: `Piloted ${name}`, timestamp: startTime }];

      if (endTime) {
        events = [...events, { type: "Parked", timestamp: endTime }];
      }

      return events;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Flight log</Heading>
      <Table>
        <Tbody>
          {events.map(({ type }, index) => {
            return (
              <Tr key={`flight-log-${index}`}>
                <Td pl={p}>{type}</Td>
                <Td pr={p} isNumeric>
                  0x96ff...4651
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};
