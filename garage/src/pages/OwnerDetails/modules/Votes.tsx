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
  Show,
  useBreakpointValue,
} from "@chakra-ui/react";
import { prettyNumber } from "../../../utils/fmt";
import { Vote } from "../../../hooks/useOwnerVotes";
import { Link } from "react-router-dom";

interface VotesProps extends React.ComponentProps<typeof Box> {
  votes?: Vote[];
}

const truncateChoiceString = (s: string, l: number = 80) =>
  s.slice(0, l) + (s.length > l ? "..." : "");

const noBorderBottom = { borderBottom: "none" };

export const Votes = ({ votes, p, ...props }: VotesProps) => {
  const isMobile = useBreakpointValue({
    base: true,
    sm: false,
  });

  const mainRowColAttrs = isMobile ? noBorderBottom : {};

  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Votes</Heading>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th pl={p} maxWidth={{ base: "100%", sm: "230px" }}>
              Proposal
            </Th>
            <Show above="sm">
              <Th>Choices</Th>
            </Show>
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
                <React.Fragment key={`vote-${index}`}>
                  <Tr>
                    <Td pl={p} maxWidth="230px" {...mainRowColAttrs}>
                      <Link to={`/proposals/${proposal.id}`}>
                        {proposal.name}
                      </Link>
                    </Td>
                    <Show above="sm">
                      <Td title={choiceString}>
                        {truncateChoiceString(choiceString)}
                      </Td>
                    </Show>
                    <Td pr={p} isNumeric {...mainRowColAttrs}>
                      {prettyNumber(ft)}
                    </Td>
                  </Tr>
                  <Show below="sm">
                    <Tr>
                      <Td px={p} pt={0} colSpan={2} title={choiceString}>
                        {truncateChoiceString(choiceString)}
                      </Td>
                    </Tr>
                  </Show>
                </React.Fragment>
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
