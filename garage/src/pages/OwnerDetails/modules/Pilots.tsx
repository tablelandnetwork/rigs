import React from "react";
import {
  Box,
  Flex,
  Heading,
  Image,
  Show,
  Spinner,
  Table,
  Tbody,
  Thead,
  Th,
  Text,
  Tr,
  Td,
  VStack,
} from "@chakra-ui/react";
import { NFT } from "../../../hooks/useNFTs";
import { PilotWithFT } from "../../../hooks/useOwnerPilots";
import { TrainerPilot } from "../../../components/TrainerPilot";
import { findNFT } from "../../../utils/nfts";
import { prettyNumber } from "../../../utils/fmt";

interface PilotProps extends React.ComponentProps<typeof Box> {
  nfts?: NFT[];
  pilots?: PilotWithFT[];
}

export const Pilots = ({ pilots, nfts, p, ...props }: PilotProps) => {
  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Pilots {pilots && `(${pilots.length})`}</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} colSpan={2}>
              Pilot
            </Th>
            <Th isNumeric>
              <Show above="sm">Flight time (FT)</Show>
              <Show below="sm">FT</Show>
            </Th>
            <Th pr={p}>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {pilots &&
            nfts &&
            pilots.map(({ contract, tokenId, flightTime, isActive }, index) => {
              const nft = findNFT({ contract, tokenId }, nfts);

              return (
                <Tr key={`pilots-${index}`}>
                  <Td
                    pl={p}
                    pr={0}
                    width={`calc(var(--chakra-sizes-${p}) + 30px)`}
                  >
                    {nft?.imageUrl ? (
                      <Image
                        src={nft.imageUrl}
                        width="30px"
                        height="30px"
                        backgroundColor="primary"
                      />
                    ) : (
                      <TrainerPilot width="30px" height="30px" />
                    )}
                  </Td>
                  <Td pl={3} wordBreak="break-all">
                    {nft?.name || "Trainer"}
                  </Td>
                  <Td isNumeric>{prettyNumber(flightTime)}</Td>
                  <Td pr={p} color={isActive ? "inherit" : "inactive"}>
                    {isActive ? "Active" : "Inactive"}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
      {!pilots && (
        <Flex justify="center" p={p}>
          <Spinner />
        </Flex>
      )}
      {pilots?.length === 0 && (
        <Text px={p} py={4} variant="emptyState">
          This wallet has no pilots yet.
        </Text>
      )}
    </VStack>
  );
};
