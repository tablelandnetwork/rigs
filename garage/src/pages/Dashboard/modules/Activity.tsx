import React from "react";
import {
  Box,
  Flex,
  Heading,
  Image,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
} from "@chakra-ui/react";
import { useRigImageUrls } from "../../../hooks/useRigImageUrls";
import { useRigsActivity } from "../../../hooks/useRigsActivity";

export const Activity = (props: React.ComponentProps<typeof Box>) => {
  const { events } = useRigsActivity();
  const { p = "8px", ...otherProps } = props;

  return (
    <Flex
      direction="column"
      pt={p}
      mb={8}
      sx={{ height: "100%", minWidth: { xl: "400px" } }}
      {...otherProps}
    >
      <Heading px={p}>Activity</Heading>
      {!events && (
        <Flex align="center" justify="center">
          <Spinner m={p} size="md" />
        </Flex>
      )}
      <Table>
        <Tbody>
          {events &&
            events.map(({ rigId, thumb, action }, index) => {
              const { thumb: thumbUrl } = useRigImageUrls({ id: rigId, thumb });
              return (
                <Tr key={`activity-row-${index}`}>
                  <Td
                    pl={p}
                    pr={0}
                    width={`calc(var(--chakra-sizes-${p}) + 20px)`}
                  >
                    <Image
                      src={thumbUrl}
                      alt={`Rig ${rigId}`}
                      sx={{ width: "20px", height: "20px" }}
                    />
                  </Td>
                  <Td>{`#${rigId}`}</Td>
                  <Td
                    pr={p}
                    sx={{
                      maxWidth: { base: "200px", md: "300px" },
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                    isNumeric
                  >
                    {action}
                  </Td>
                </Tr>
              );
            })}
          {events && events.length === 0 && (
            <Text p={p} variant="emptyState">
              No activity yet.
            </Text>
          )}
        </Tbody>
      </Table>
    </Flex>
  );
};
