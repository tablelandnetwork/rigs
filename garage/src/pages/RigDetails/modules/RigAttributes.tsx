import React from "react";
import { Box, Heading, Table, Tbody, Td, Tr, VStack } from "@chakra-ui/react";
import { RigWithPilots } from "../../../types";

type RigAttributesProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
};

export const RigAttributes = ({ rig, p, ...props }: RigAttributesProps) => {
  if (!rig.attributes) return null;

  return (
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Properties</Heading>
      <Table variant="simple">
        <Tbody>
          {rig.attributes
            .filter(({ traitType }) => traitType !== "VIN")
            .map((attribute) => {
              return (
                <Tr key={`rig-${rig.id}-attribute-${attribute.traitType}`}>
                  <Td pl={p}>{attribute.traitType}</Td>
                  <Td pr={p} isNumeric>
                    {attribute.value}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Table>
    </VStack>
  );
};
