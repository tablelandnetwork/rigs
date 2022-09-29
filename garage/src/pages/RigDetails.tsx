import React from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Text,
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
const PAPER_TABLE_PT = 6;
const PAPER_TABLE_HEADING_PX = 6;

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
      <Heading as="h3" px={PAPER_TABLE_HEADING_PX}>
        Properties
      </Heading>
      <TableContainer>
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
                    <Td {...tdProps}>{attribute.trait_type}</Td>
                    <Td {...tdProps} textAlign="right">
                      {attribute.value}
                    </Td>
                  </Tr>
                );
              })}
          </Tbody>
        </Table>
      </TableContainer>
    </VStack>
  );
};

const Pilots = ({ rig }: RigModuleProps) => {
  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading as="h3" px={PAPER_TABLE_HEADING_PX}>
        Rig {`#${rig.id}`}
      </Heading>
      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Pilot</Th>
              <Th>Flight time (FT)</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>Moonbird #8969</Td>
              <Td>17,280</Td>
              <Td>Active</Td>
            </Tr>
            <Tr>
              <Td>Trainer</Td>
              <Td>123,456</Td>
              <Td>Garaged</Td>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </VStack>
  );
};

const Badges = ({ rig }: RigModuleProps) => {
  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading as="h3" px={PAPER_TABLE_HEADING_PX}>
        Badges
      </Heading>
      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Earned by</Th>
              <Th>Visibility</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>Coding</Td>
              <Td>Moonbird #8969</Td>
              <Td>Visible</Td>
            </Tr>
            <Tr>
              <Td>Education</Td>
              <Td>Trainer</Td>
              <Td>Hidden</Td>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </VStack>
  );
};

const FlightLog = ({ rig }: RigModuleProps) => {
  return (
    <VStack align="stretch" bg="paper" pt={PAPER_TABLE_PT}>
      <Heading as="h3" px={PAPER_TABLE_HEADING_PX}>
        Flight log
      </Heading>
      <TableContainer>
        <Table>
          <Tbody>
            <Tr>
              <Td>Earned Coding Badge</Td>
              <Td>0x.....</Td>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
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
        <Flex justify="space-between" width="100%">
          <Button as={Link} to="/dashboard">
            Dashboard
          </Button>
          <ConnectButton />
        </Flex>
      </Topbar>
      <Grid
        templateColumns="repeat(2, 1fr)"
        pt={GRID_GAP}
        gap={GRID_GAP}
        maxWidth="1200px"
        height="100%"
      >
        {rig && (
          <>
            <GridItem>
              <VStack align="stretch">
                <RigViewer rig={rig} />
                <RigAttributes rig={rig} />
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch">
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
