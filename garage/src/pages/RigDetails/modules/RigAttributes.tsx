import React from "react";
import { Heading, Table, Tbody, Td, Tr, VStack } from "@chakra-ui/react";
import { RigWithPilots } from "../../../types";

const PAPER_TABLE_PT = 8;
const PAPER_TABLE_HEADING_PX = 8;

interface RigAttributesProps {
  rig: RigWithPilots;
}

export const RigAttributes = ({ rig }: RigAttributesProps) => {
  if (!rig.attributes) return null;

  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Properties</Heading>
      <Table variant="simple">
        <Tbody>
          {rig.attributes
            .filter(({ traitType }) => traitType !== "VIN")
            .map((attribute, index) => {
              const tdProps =
                index === rig.attributes!.length - 1
                  ? { borderBottom: "none" }
                  : index === 0
                  ? { borderTop: "var(--chakra-borders-1px)" }
                  : {};
              return (
                <Tr key={`rig-${rig.id}-attribute-${attribute.traitType}`}>
                  <Td pl={8} {...tdProps}>
                    {attribute.traitType}
                  </Td>
                  <Td pr={8} {...tdProps} textAlign="right">
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
