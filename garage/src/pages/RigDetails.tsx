import React from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  Image,
  Spinner,
  Table,
  Tbody,
  Thead,
  Td,
  Th,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { Rig } from "../types";
import { Topbar } from "../Topbar";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRig } from "../hooks/useRig";
import { useRigImageUrls } from "../hooks/useRigImageUrls";

const GRID_GAP = 4;
const PAPER_TABLE_PT = 8;
const PAPER_TABLE_HEADING_PX = 8;

interface RigModuleProps {
  rig: Rig;
}

const RigViewer = ({ rig }: RigModuleProps) => {
  const { image: imageUrl } = useRigImageUrls(rig);

  // TODO: render pilot & badges
  return (
    <Box bg="paper" p={2}>
      <Image src={imageUrl} />
    </Box>
  );
};

const RigAttributes = ({ rig }: RigModuleProps) => {
  if (!rig.attributes) return null;

  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Properties</Heading>
      <Table variant="simple">
        <Tbody>
          {rig.attributes
            .filter(({ trait_type }) => trait_type !== "VIN")
            .map((attribute, index) => {
              const tdProps =
                index === rig.attributes!.length - 1
                  ? { borderBottom: "none" }
                  : index === 0
                  ? { borderTop: "var(--chakra-borders-1px)" }
                  : {};
              return (
                <Tr key={`rig-${rig.id}-attribute-${attribute.trait_type}`}>
                  <Td pl={8} {...tdProps}>
                    {attribute.trait_type}
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

const Pilots = ({ rig }: RigModuleProps) => {
  const data = [
    { pilot: "Moonbird #8969", flightTime: "17,280", status: "Active" },
    { pilot: "Trainer", flightTime: "123,456", status: "Garaged" },
  ];

  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Rig {`#${rig.id}`}</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={8}>Pilot</Th>
            <Th>Flight time (FT)</Th>
            <Th pr={8}>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(({ pilot, flightTime, status }, index) => {
            return (
              <Tr key={`pilots-${index}`}>
                <Td pl={8}>{pilot}</Td>
                <Td>{flightTime}</Td>
                <Td pr={8}>{status}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};

const Badges = ({ rig }: RigModuleProps) => {
  const data = [
    { badge: "Coding", pilot: "Moonbird #8969", visibility: "Visible" },
    { badge: "Education", pilot: "Trainer", visibility: "Hidden" },
  ];
  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Badges</Heading>
      <Table>
        <Thead>
          <Tr>
            <Th pl={8}>Name</Th>
            <Th>Earned by</Th>
            <Th pr={8}>Visibility</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(({ badge, pilot, visibility }, index) => {
            return (
              <Tr key={`badges-${index}`}>
                <Td pl={8}>{badge}</Td>
                <Td>{pilot}</Td>
                <Td pr={8}>{visibility}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};

const FlightLog = ({ rig }: RigModuleProps) => {
  const data = [
    { event: "Earned Coding Badge", wallet: "0x96ff...4651" },
    { event: "Piloted Moonbird #8979", wallet: "0x96ff...4651" },
    { event: "Parked", wallet: "0x96ff...4651" },
    { event: "Earned Education Badge", wallet: "0x96ff...4651" },
    { event: "Piloted Trainer", wallet: "0x96ff...4651" },
  ];

  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading px={PAPER_TABLE_HEADING_PX}>Flight log</Heading>
      <Table>
        <Tbody>
          {data.map(({ event, wallet }, index) => {
            return (
              <Tr key={`flight-log-${index}`}>
                <Td pl={8}>{event}</Td>
                <Td pr={8} isNumeric>
                  {wallet}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </VStack>
  );
};

export const RigDetails = () => {
  const { id } = useParams();
  const { rig } = useRig(id || "");

  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      sx={{ width: "100%", height: "100%" }}
    >
      <Topbar>
        <Flex justify="space-between" align="center" width="100%" ml={4}>
          <Button as={Link} to="/dashboard">
            Dashboard
          </Button>
          <ConnectButton />
        </Flex>
      </Topbar>
      <Grid
        templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(2, 1fr)" }}
        pt={GRID_GAP}
        gap={GRID_GAP}
        px={GRID_GAP}
        maxWidth="1385px"
        height="100%"
      >
        {rig && (
          <>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <RigViewer rig={rig} />
                <RigAttributes rig={rig} />
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={GRID_GAP}>
                <Pilots rig={rig} />
                <Badges rig={rig} />
                <FlightLog rig={rig} />
              </VStack>
            </GridItem>
          </>
        )}

        {!rig && <Spinner />}
      </Grid>
    </Flex>
  );
};
