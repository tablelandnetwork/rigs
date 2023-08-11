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
import { prettyNumber } from "../../../utils/fmt";
import { Vote } from "../../../hooks/useOwnerVotes";
import { Link } from "react-router-dom";

interface VotesProps extends React.ComponentProps<typeof Box> {
  votes?: Vote[];
}

const truncateChoiceString = (s: string, l: number = 80) =>
  s.slice(0, l) + (s.length > l ? "..." : "");

export const Votes = ({ votes, p, ...props }: VotesProps) => {
  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Votes</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} width="190px">
              Proposal
            </Th>
            <Th>Choices</Th>
            <Th pr={p} isNumeric>
              Voting Power
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {votes &&
            votes.map(({ choices, proposal, ft }, index) => {
              const { options } = proposal;

              const optionLookupMap = Object.fromEntries(
                options.map(({ id, description }) => [id, description])
              );
              const choiceString = choices
                .map(
                  ({ optionId, weight }) =>
                    `${weight}% for ${optionLookupMap[optionId]}`
                )
                .join(", ");
              return (
                <Tr key={`vote-${index}`}>
                  <Td pl={p} width="130px">
                    <Link to={`/proposals/${proposal.id}`}>
                      {proposal.name}
                    </Link>
                  </Td>
                  <Td title={choiceString}>{truncateChoiceString(choiceString)}</Td>
                  <Td pr={p} isNumeric>
                    {prettyNumber(ft)}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
      {!votes && (
        <Flex justify="center" p={p}>
          <Spinner />
        </Flex>
      )}
      {votes?.length === 0 && (
        <Text px={p} py={4} variant="emptyState">
          This wallet has not voted in any proposals yet.
        </Text>
      )}
    </VStack>
  );
};
