import React from "react";
import { Heading, Flex, Image, Table, Tbody, Tr, Td } from "@chakra-ui/react";
import { useRigImageUrls } from "../../../hooks/useRigImageUrls";
import { useRigsActivity } from "../../../hooks/useRigsActivity";

export const Activity = () => {
  const { events } = useRigsActivity();

  return (
    <Flex direction="column" bgColor="paper" pt={8} mb={8} sx={{ height: "100%" }}>
      <Heading px={8}>Activity</Heading>
      <Table>
        <Tbody>
          {events.map(({ rigId, thumb, action }, index) => {
            const { thumb: thumbUrl } = useRigImageUrls({ id: rigId, thumb });
            return (
              <Tr key={`activity-row-${index}`}>
                <Td pl={8} pr={0}>
                  <Image
                    src={thumbUrl}
                    alt={`Rig ${rigId}`}
                    sx={{ width: "20px", height: "20px" }}
                  />
                </Td>
                <Td textAlign="start">{`#${rigId}`}</Td>
                <Td textAlign="end" pr={8}>
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
