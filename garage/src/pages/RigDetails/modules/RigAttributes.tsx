import React from "react";
import {
  Badge,
  Box,
  Heading,
  HStack,
  Table,
  Tbody,
  Td,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { RigWithPilots, Attribute } from "../../../types";
import { useRigAttributeStats } from "../../../components/RigAttributeStatsContext";
import { toPercent } from "../../../utils/fmt";

type RigAttributesProps = React.ComponentProps<typeof Box> & {
  rig: RigWithPilots;
};

const truncate = (input: any) => {
  const value = input.toString();

  if (value.length < 40) return value;

  return `${value.slice(0, 24)}...${value.slice(value.length - 4)}`;
};

const NON_PART_ATTRIBUTES = [
  "VIN",
  "Background",
  "Color",
  "Name",
  "Fleet",
  "% Original",
];

type AttributesTableProps = React.ComponentProps<typeof Table> & {
  attributes: Attribute[];
};

const AttributesTable = ({ attributes, p }: AttributesTableProps) => {
  const rarities = useRigAttributeStats();

  return (
    <Table variant="simple">
      <Tbody>
        {attributes.map((attribute) => {
          const rarity = rarities?.[attribute.traitType][attribute.value];
          return (
            <Tr key={`attribute-${attribute.traitType}`}>
              <Td pl={p}>{attribute.traitType}</Td>
              <Td isNumeric>{truncate(attribute.value)}</Td>
              <Td pl={0} pr={p} width="30px" color="inactive" isNumeric>
                {rarity !== undefined && (
                  <span>{toPercent(rarity / 3000)}%</span>
                )}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export const RigAttributes = ({ rig, p, ...props }: RigAttributesProps) => {
  if (!rig.attributes) return null;

  const original = rig.attributes.filter(
    ({ traitType }) => traitType === "% Original"
  )[0];
  const properties = rig.attributes.filter(
    ({ traitType }) =>
      NON_PART_ATTRIBUTES.includes(traitType) &&
      traitType !== "% Original" &&
      traitType !== "VIN"
  );
  const parts = rig.attributes.filter(
    ({ traitType }) => !NON_PART_ATTRIBUTES.includes(traitType)
  );

  const isOriginal = original.value.toString() === "100";

  return (
    <VStack align="stretch" pt={p} {...props}>
      <Heading px={p}>Properties </Heading>
      <AttributesTable attributes={properties} p={p} />
      <HStack px={p} pt={p} align="stretch" justify="space-between">
        <Heading>Parts</Heading>
        <Badge
          colorScheme={isOriginal ? "green" : "primary"}
          variant="solid"
          fontSize="sm"
          p={2}
        >
          {original.value}% Original
        </Badge>
      </HStack>
      <AttributesTable attributes={parts} p={p} />
    </VStack>
  );
};
