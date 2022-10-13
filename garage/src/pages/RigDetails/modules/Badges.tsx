import React from "react";
import {
  Box,
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

type BadgesProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  nfts: NFT[];
};

export const Badges = ({ rig, p, ...props }: BadgesProps) => {
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
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Badges</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} colSpan={2}>
              Name
            </Th>
            <Th>Earned by</Th>
            <Th pr={p}>Visibility</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(({ badge, pilot, visibility, badgeImageUrl }, index) => {
            return (
              <Tr key={`badges-${index}`}>
                <Td pl={p} pr={0}>
                  <Image src={badgeImageUrl} width="30px" height="30px" />
                </Td>
                <Td pl={0}>{badge}</Td>
                <Td>{pilot}</Td>
                <Td pr={p}>{visibility}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};
