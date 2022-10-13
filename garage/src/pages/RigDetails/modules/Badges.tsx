import React from "react";
import {
  Heading,
  Image,
  Spinner,
  Table,
  Tbody,
  Thead,
  Td,
  Th,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { RigWithPilots } from "../../../types";
import { NFT } from "../../../hooks/useNFTs";
import { education, code } from "../../../assets/badges/";

const PAPER_TABLE_PT = 8;
const PAPER_TABLE_HEADING_PX = 8;

interface BadgesProps {
  rig: RigWithPilots;
  nfts: NFT[];
};

export const Badges = ({ rig }: BadgesProps) => {
  const data = [
    {
      badge: "Coding",
      badgeImageUrl: code,
      pilot: "Moonbird #8969",
      visibility: "Visible",
    },
    {
      badge: "Education",
      badgeImageUrl: education,
      pilot: "Trainer",
      visibility: "Hidden",
    },
  ];
  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Badges</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={8} colSpan={2}>
              Name
            </Th>
            <Th>Earned by</Th>
            <Th pr={8}>Visibility</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(({ badge, pilot, visibility, badgeImageUrl }, index) => {
            return (
              <Tr key={`badges-${index}`}>
                <Td pl={8} pr={0}>
                  <Image src={badgeImageUrl} width="30px" height="30px" />
                </Td>
                <Td pl={0}>{badge}</Td>
                <Td>{pilot}</Td>
                <Td pr={8}>{visibility}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};
