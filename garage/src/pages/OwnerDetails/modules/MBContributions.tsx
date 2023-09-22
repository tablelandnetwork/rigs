import React from "react";
import { Link } from "react-router-dom";
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
  useBreakpointValue,
  Show,
} from "@chakra-ui/react";
import { MissionContribution } from "../../../types";

interface MBContributionsProps extends React.ComponentProps<typeof Box> {
  contributions?: MissionContribution[];
}

const noBorderBottom = { borderBottom: "none" };

export const MBContributions = ({
  contributions,
  p,
  ...props
}: MBContributionsProps) => {
  const isMobile = useBreakpointValue({
    base: true,
    sm: false,
  });

  const mainRowColAttrs = isMobile ? noBorderBottom : {};

  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>MB Contributions</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={p} width="130px">
              Block number
            </Th>
            <Show above="sm">
              <Th>Approval Message</Th>
            </Show>
            <Th pr={p} width="120px" isNumeric>
              Mission ID
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {contributions &&
            contributions.map(
              ({ missionId, createdAt, acceptanceMotivation }, index) => {
                return (
                  <React.Fragment key={`contribution-${index}`}>
                    <Tr>
                      <Td pl={p} width="130px" {...mainRowColAttrs}>
                        {createdAt}
                      </Td>
                      <Show above="sm">
                        <Td>{acceptanceMotivation}</Td>
                      </Show>
                      <Td pr={p} width="120px" isNumeric {...mainRowColAttrs}>
                        <Link to={`/missions/${missionId}`}>{missionId}</Link>
                      </Td>
                    </Tr>
                    <Show below="sm">
                      <Tr>
                        <Td px={p} pt={0} colSpan={2}>
                          {acceptanceMotivation}
                        </Td>
                      </Tr>
                    </Show>
                  </React.Fragment>
                );
              }
            )}
        </Tbody>
      </Table>
      {!contributions && (
        <Flex justify="center" p={p}>
          <Spinner />
        </Flex>
      )}
      {contributions?.length === 0 && (
        <Text px={p} py={4} variant="emptyState">
          This wallet has not contributed to any missions yet.
        </Text>
      )}
    </VStack>
  );
};
