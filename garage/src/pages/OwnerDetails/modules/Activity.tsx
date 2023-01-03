import React from "react";
import {
  Box,
  Flex,
  Heading,
  Image,
  Spinner,
  Table,
  Tbody,
  Text,
  Tr,
  Td,
  VStack,
} from "@chakra-ui/react";
import { useRigImageUrls } from "../../../hooks/useRigImageUrls";
import { Event } from "../../../types";

interface ActivityLogProps extends React.ComponentProps<typeof Box> {
  events?: Event[];
}

export const ActivityLog = ({ events, p, ...props }: ActivityLogProps) => {
  // TODO add table header? might look nicer since the pilots table has one
  return (
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Activity</Heading>
      <Table>
        <Tbody>
          {events &&
            events.map(({ action, rigId, thumb }, index) => {
              const { thumb: thumbUrl } = useRigImageUrls({ id: rigId, thumb });
              return (
                <Tr key={`flight-log-${index}`}>
                  <Td pl={p} pr={0}>
                    <Image
                      src={thumbUrl}
                      alt={`Rig ${rigId}`}
                      sx={{ width: "20px", height: "20px", maxWidth: "20px" }}
                    />
                  </Td>
                  <Td pl={0}>Rig #{rigId}</Td>
                  <Td pr={p} isNumeric>
                    {action}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
      {!events && (
        <Flex p={p} justify="center">
          <Spinner />
        </Flex>
      )}
      {events?.length === 0 && (
        <Text p={p} variant="emptyState">
          This wallet has no Rigs activity yet.
        </Text>
      )}
    </VStack>
  );
};
