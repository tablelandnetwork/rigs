import React from "react";
import {
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

const PAPER_TABLE_PT = 8;
const PAPER_TABLE_HEADING_PX = 8;

interface FlightLogProps {
  rig: RigWithPilots;
  nfts: NFT[];
}

export const FlightLog = ({ rig, nfts }: FlightLogProps) => {
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
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Flight log</Heading>
      <Table>
        <Tbody>
          {events.map(({ type }, index) => {
            return (
              <Tr key={`flight-log-${index}`}>
                <Td pl={8}>{type}</Td>
                <Td pr={8} isNumeric>
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
