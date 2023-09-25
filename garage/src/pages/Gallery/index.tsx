import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionIcon,
  AccordionButton,
  AccordionPanel,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  Spinner,
  Text,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { TOPBAR_HEIGHT } from "~/Topbar";
import { RigDisplay } from "~/components/RigDisplay";
import { Footer } from "~/components/Footer";
import { Rig } from "~/types";
import { useTablelandConnection } from "~/hooks/useTablelandConnection";
import { NFT } from "~/hooks/useNFTs";
import { selectFilteredRigs } from "~/utils/queries";
import { isPresent } from "~/utils/types";
import { findNFT } from "~/utils/nfts";
import { useNFTsCached } from "~/components/NFTsContext";
import { ActiveFiltersBar, FilterPanel, toggleValue } from "./modules/Filters";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
};

const PAGE_LIMIT = 20;

export type Filters = Record<string, Set<string>>;

interface FlightTimeFilters {
  isTrained: boolean;
  isInFlight: boolean;
}

const DEFAULT_FLIGHT_TIME_FILTERS = {
  isTrained: false,
  isInFlight: false,
};

const RigGridItem = ({ rig, pilotNFT }: { rig: Rig; pilotNFT?: NFT }) => {
  return (
    <RouterLink
      to={`/rigs/${rig.id}`}
      style={{ position: "relative", display: "block", textDecoration: "none" }}
    >
      <VStack>
        <RigDisplay
          rig={rig}
          pilotNFT={pilotNFT}
          loading={!!rig.currentPilot?.contract && !pilotNFT}
          border={1}
          borderStyle="solid"
          borderColor="black"
          borderRadius="3px"
        />
        <Text>
          Rig #{rig.id} ({rig.currentPilot ? "In-flight" : "Parked"})
        </Text>
      </VStack>
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
        _hover={{ backgroundColor: "rgba(0,0,0,0.15)" }}
        transition=".2s"
      />
    </RouterLink>
  );
};

export const Gallery = () => {
  const { db } = useTablelandConnection();

  const [{ loading, allLoaded, rigs }, setState] = useState({
    loading: false,
    allLoaded: false,
    rigs: [] as Rig[],
  });

  const currentPilots = useMemo(() => {
    return rigs.map((v) => v.currentPilot).filter(isPresent);
  }, [rigs]);

  const { nfts } = useNFTsCached(currentPilots);

  const [filters, setFilters] = useState<Filters>({});
  const [flightTimeFilters, setFlightTimeFilters] = useState<FlightTimeFilters>(
    DEFAULT_FLIGHT_TIME_FILTERS
  );

  const isMobile = useBreakpointValue(
    { base: true, lg: false },
    { ssr: false }
  );

  // Effect that fetches new results when filters change
  useEffect(() => {
    setState({ rigs: [], allLoaded: false, loading: true });
    db.prepare(selectFilteredRigs(filters, flightTimeFilters, PAGE_LIMIT, 0))
      .all<Rig>()
      .then((v) => {
        setState({
          loading: false,
          rigs: v.results,
          allLoaded: v.results.length < PAGE_LIMIT,
        });
      });
  }, [db, filters, flightTimeFilters, setState]);

  // Callback that is called to load more results for the current filters
  const loadMore = useCallback(() => {
    if (db) {
      setState((old) => {
        return { ...old, loading: true };
      });
      db.prepare(
        selectFilteredRigs(filters, flightTimeFilters, PAGE_LIMIT, rigs.length)
      )
        .all<Rig>()
        .then((v) => {
          setState((old) => {
            return {
              ...old,
              rigs: [...old.rigs, ...v.results],
              loading: false,
              allLoaded: v.results.length < PAGE_LIMIT,
            };
          });
        });
    }
  }, [db, filters, flightTimeFilters, rigs, setState]);

  const toggleFilter = useCallback(
    (trait: string, value: string) => {
      setFilters((oldValue: Filters) => toggleValue(oldValue, trait, value));
    },
    [setFilters]
  );

  const clearFilters = useCallback(() => setFilters({}), [setFilters]);

  return (
    <>
      <Flex
        direction="column"
        align="center"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT} + 40px)`}
        mb="40px"
      >
        <Box
          maxWidth="1385px"
          width="100%"
          minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
        >
          <Flex
            direction={{ base: "column", lg: "row" }}
            p={GRID_GAP}
            gap={GRID_GAP}
            align={{ base: "stretch", lg: "start" }}
          >
            <Box
              {...MODULE_PROPS}
              width={{ base: "100%", lg: "300px" }}
              flexShrink="0"
            >
              {isMobile && (
                <Accordion allowToggle width="100%">
                  <AccordionItem border="none">
                    <Heading>
                      <AccordionButton px="0" fontSize="2xl">
                        <Box as="span" flex="1" textAlign="left">
                          Filters
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </Heading>
                    <AccordionPanel px="0">
                      <FilterPanel
                        filters={filters}
                        toggleFilter={toggleFilter}
                        clearFilters={clearFilters}
                        flightTimeFilters={flightTimeFilters}
                        setFlightTimeFilters={setFlightTimeFilters}
                      />
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              )}
              {!isMobile && (
                <>
                  <Heading mb={10}>Filters</Heading>
                  <FilterPanel
                    filters={filters}
                    toggleFilter={toggleFilter}
                    clearFilters={clearFilters}
                    flightTimeFilters={flightTimeFilters}
                    setFlightTimeFilters={setFlightTimeFilters}
                  />
                </>
              )}
            </Box>
            <VStack {...MODULE_PROPS} align="start" flexGrow="1">
              <ActiveFiltersBar
                filters={filters}
                toggleFilter={toggleFilter}
                clearFilters={clearFilters}
                flightTimeFilters={flightTimeFilters}
                setFlightTimeFilters={setFlightTimeFilters}
              />
              <Grid
                pt={4}
                gap={GRID_GAP}
                templateColumns={{
                  base: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                  xl: "repeat(4, 1fr)",
                }}
              >
                {rigs.map((rig, index) => {
                  const currentNFT =
                    rig.currentPilot && nfts && findNFT(rig.currentPilot, nfts);
                  return (
                    <GridItem key={index}>
                      <RigGridItem rig={rig} pilotNFT={currentNFT} />
                    </GridItem>
                  );
                })}
              </Grid>
              {rigs.length === 0 && loading && <Spinner />}
              {!allLoaded && rigs.length > 0 && (
                <Flex pt={8} width="100%" justify="center">
                  <Button
                    size="md"
                    onClick={loadMore}
                    isLoading={loading || rigs.length === 0}
                  >
                    Load more
                  </Button>
                </Flex>
              )}
            </VStack>
          </Flex>
        </Box>
      </Flex>
      <Footer />
    </>
  );
};
