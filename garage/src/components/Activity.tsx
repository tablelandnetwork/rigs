import React from "react";
import { Heading, Flex, Image, Table, Tbody, Tr, Td } from "@chakra-ui/react";
import { useRigImageUrls } from "../hooks/useRigImageUrls";
import { useRigsActivity } from "../hooks/useRigsActivity";

export const Activity = () => {
  const { events } = useRigsActivity();

  return (
    <Flex
      direction="column"
      bgColor="paper"
      p={7}
      sx={{ height: "100%" }}
    >
      <Heading>Activity</Heading>
      <Table>
        <Tbody>
          {events.map(({ rigId, thumb, action }, index) => {
            const { thumb: thumbUrl } = useRigImageUrls({ id: rigId, thumb });
            return (
              <Tr key={`activity-row-${index}`}>
                <Td>
                  <Image
                    src={thumbUrl}
                    alt={`Rig ${rigId}`}
                    sx={{ width: "25px", height: "25px" }}
                  />
                </Td>
                <Td textAlign="start">{`#${rigId}`}</Td>
                <Td textAlign="end">{action}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Flex>
  );
};
