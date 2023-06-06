import React from "react";
import {
  Box,
  Flex,
  Heading,
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
import { FTReward } from "../../../types";
import { prettyNumber } from "../../../utils/fmt";

interface FTRewardsProps extends React.ComponentProps<typeof Box> {
  rewards?: FTReward[];
}

export const FTRewards = ({ rewards, p, ...props }: FTRewardsProps) => {
  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>FT Rewards</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} width="130px">
              Block number
            </Th>
            <Th>Explanation</Th>
            <Th pr={p} isNumeric>
              Amount
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {rewards &&
            rewards.map(({ blockNum, reason, amount }, index) => {
              return (
                <Tr key={`reward-${index}`}>
                  <Td pl={p} width="130px">
                    {blockNum}
                  </Td>
                  <Td>{reason}</Td>
                  <Td pr={p} isNumeric>
                    {prettyNumber(amount)}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
      {!rewards && (
        <Flex justify="center" p={p}>
          <Spinner />
        </Flex>
      )}
      {rewards?.length === 0 && (
        <Text px={p} py={4} variant="emptyState">
          This wallet has not received any FT rewards.
        </Text>
      )}
    </VStack>
  );
};
