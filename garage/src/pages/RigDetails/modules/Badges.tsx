import React from "react";
import {
  Box,
  Heading,
  Image,
  Show,
  Spinner,
  Table,
  Tbody,
  Thead,
  Td,
  Text,
  Th,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { RigWithPilots } from "~/types";
import { NFT } from "~/hooks/useNFTs";
import { education, code } from "~/assets/badges/";

type BadgesProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
  nfts: NFT[];
};

const shortVisibilityString = (visibility: string) => {
  return visibility === "Visible" ? "Yes" : "No";
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
            <Th pr={p}>
              <Show above="sm">Visibility</Show>
              <Show below="sm">Shown</Show>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(({ badge, pilot, visibility, badgeImageUrl }, index) => {
            return (
              <Tr key={`badges-${index}`}>
                <Td
                  pl={p}
                  pr={0}
                  width={`calc(var(--chakra-sizes-${p}) + 30px)`}
                >
                  <Image
                    src={badgeImageUrl}
                    width="30px"
                    height="30px"
                    minWidth="30px"
                  />
                </Td>
                <Td pl={3}>{badge}</Td>
                <Td wordBreak="break-all">{pilot}</Td>
                <Td
                  pr={p}
                  color={visibility == "Hidden" ? "inactive" : "inherit"}
                >
                  <Show above="sm">{visibility}</Show>
                  <Show below="sm">{shortVisibilityString(visibility)}</Show>
                </Td>
              </Tr>
            );
          })}
          {data.length === 0 && (
            <Text p={p} variant="emptyState">
              This rig has not earned any badges.
            </Text>
          )}
        </Tbody>
      </Table>
    </VStack>
  );
};
