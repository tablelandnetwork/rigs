import React from "react";
import {
  Box,
  Heading,
  Flex,
  Image,
  Table,
  Tbody,
  Tr,
  Td,
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
      <Table>
        <Tbody>
          {events &&
            events.map(({ rigId, thumb, action }, index) => {
              const { thumb: thumbUrl } = useRigImageUrls({ id: rigId, thumb });
              return (
                <Tr key={`activity-row-${index}`}>
                  <Td pl={p} pr={0}>
                    <Image
                      src={thumbUrl}
                      alt={`Rig ${rigId}`}
                      sx={{ width: "20px", height: "20px" }}
                    />
                  </Td>
                  <Td textAlign="start">{`#${rigId}`}</Td>
                  <Td
                    textAlign="end"
                    pr={p}
                    sx={{
                      maxWidth: { base: "200px", md: "300px" },
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {action}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
    </Flex>
  );
};
