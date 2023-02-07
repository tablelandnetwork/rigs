import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionIcon,
  AccordionButton,
  AccordionPanel,
  Box,
  Button,
  Checkbox,
  Flex,
  Grid,
  GridItem,
  Heading,
  Input,
  InputGroup,
  InputRightElement,
  Spinner,
  Switch,
  Tag,
  TagLabel,
  TagCloseButton,
  Text,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { SmallCloseIcon } from "@chakra-ui/icons";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigDisplay } from "../../components/RigDisplay";
import { Footer } from "../../components/Footer";
import { Rig } from "../../types";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { useDebounce } from "../../hooks/useDebounce";
import { selectFilteredRigs } from "../../utils/queries";
import { copySet, toggleInSet, intersection } from "../../utils/set";
import traitData from "../../traits.json";

// TODO can we fetch this data dynamically or does that make the loading experience annoying?
const {
  fleets,
  colors,
  sharedTraits,
  individualTraits,
  traitValuesByType,
} = traitData;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
};

const PAGE_LIMIT = 20;

const overlaps = <T,>(a: Set<T>, b: Set<T>) => {
  return intersection(a, b).size > 0;
};

export type Filters = Record<string, Set<string>>;

interface FlightTimeFilters {
  isTrained: boolean;
  isInFlight: boolean;
}

const DEFAULT_FLIGHT_TIME_FILTERS = {
  isTrained: false,
  isInFlight: false,
};

const toggleValue = (
  oldValue: Filters,
  trait: string,
  value: string
): Filters => {
  let newValue = { ...oldValue };
  let traitFilters = newValue[trait];
  delete newValue[trait];

  traitFilters = traitFilters ? copySet(traitFilters) : new Set();

  const newSet = toggleInSet(traitFilters, value);
  if (newSet.size) newValue[trait] = newSet;

  return newValue;
};

interface FiltersComponentProps {
  filters: Filters;
  toggleFilter: (key: string, value: string) => void;
  clearFilters: () => void;

  flightTimeFilters: FlightTimeFilters;
  setFlightTimeFilters: React.Dispatch<React.SetStateAction<FlightTimeFilters>>;
}

interface FilterSectionValue {
  value: string;
}

interface FilterSectionProps {
  traitType: string;
  relevant: boolean;
  values: FilterSectionValue[];

  enabledFilters: Set<string>;
  toggleFilter: (key: string, value: string) => void;
}

const FilterSectionCheckbox = ({
  traitType,
  value,
  enabledFilters,
  toggleFilter,
}: Omit<FilterSectionProps, "values" | "relevant"> & {
  value: FilterSectionValue;
}) => {
  const checked = useMemo(() => !!enabledFilters?.has(value.value), [
    enabledFilters,
    value.value,
  ]);

  const onChange = useCallback(() => toggleFilter(traitType, value.value), [
    toggleFilter,
    traitType,
    value.value,
  ]);

  return (
    <Checkbox isChecked={checked} onChange={onChange}>
      {value.value}
    </Checkbox>
  );
};

const FilterSection = React.memo(
  ({
    traitType,
    relevant,
    values,
    enabledFilters,
    toggleFilter,
  }: FilterSectionProps) => {
    const [searchQuery, setSearchQuery] = useState("");

    const debouncedSearchQuery = useDebounce(searchQuery, 200);

    const filteredValues = useMemo(() => {
      return values
        .filter((v) =>
          v.value.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        )
        .sort((a, b) => a.value.localeCompare(b.value));
    }, [values, debouncedSearchQuery]);

    const handleSearchChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
      },
      [setSearchQuery]
    );

    const clearSearch = useCallback(() => setSearchQuery(""), [setSearchQuery]);

    return (
      <AccordionItem style={{ opacity: relevant ? "100%" : "60%" }}>
        <Heading as="h4">
          <AccordionButton px="0">
            <Box as="span" flex="1" textAlign="left">
              {traitType}
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </Heading>
        <AccordionPanel px="0">
          <InputGroup mb={2}>
            <Input
              size="md"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search"
            />
            <InputRightElement>
              <Button size="sm" onClick={clearSearch} variant="ghost">
                <SmallCloseIcon />
              </Button>
            </InputRightElement>
          </InputGroup>
          <VStack align="stretch">
            {filteredValues.map((value) => (
              <FilterSectionCheckbox
                traitType={traitType}
                value={value}
                enabledFilters={enabledFilters}
                toggleFilter={toggleFilter}
                key={`${traitType}:${value.value}`}
              />
            ))}
          </VStack>
        </AccordionPanel>
      </AccordionItem>
    );
  }
);

const FilterPanelHeading = (props: React.ComponentProps<typeof Heading>) => {
  return (
    <Heading as="h4" mt={6} mb={2} {...props}>
      {props.children}
    </Heading>
  );
};

const attributeSections = sharedTraits.sort();

const partsSections = Object.entries(individualTraits).sort(([a], [b]) =>
  a.localeCompare(b)
);

const colorValues = colors.map((v) => ({ value: v }));
const fleetsValues = fleets.map((v) => ({ value: v }));

interface AccordionItemWithSwitchProps {
  title: string;
  value: boolean;
  toggleValue: () => void;
}

const AccordionItemWithSwitch = ({
  title,
  value,
  toggleValue,
}: AccordionItemWithSwitchProps) => {
  return (
    <AccordionItem>
      <Heading as="h4">
        <AccordionButton
          px="0"
          onClick={(e) => {
            toggleValue();
            e.preventDefault();
          }}
        >
          <Box as="span" flex="1" textAlign="left">
            {title}
          </Box>
          <Switch isChecked={value} />
        </AccordionButton>
      </Heading>
    </AccordionItem>
  );
};

const FilterPanel = ({
  filters,
  toggleFilter,
  flightTimeFilters,
  setFlightTimeFilters,
}: FiltersComponentProps) => {
  const toggleOriginalOnlyFilter = useCallback(() => {
    toggleFilter("% Original", "100");
  }, [toggleFilter]);

  const originalOnlyEnabled = !!filters["% Original"]?.has("100");

  const toggleFlightTimeFilter = useCallback(
    (key: keyof FlightTimeFilters) => {
      setFlightTimeFilters((old) => {
        const toggle = old[key];

        let update = { ...old };
        update[key] = !toggle;

        return update;
      });
    },
    [setFlightTimeFilters]
  );

  return (
    <Accordion allowMultiple defaultIndex={[]} width="100%">
      <FilterPanelHeading>Properties</FilterPanelHeading>
      <AccordionItemWithSwitch
        title="Originals only"
        value={originalOnlyEnabled}
        toggleValue={toggleOriginalOnlyFilter}
      />
      <FilterSection
        traitType="Color"
        relevant
        values={colorValues}
        enabledFilters={filters["Color"]}
        toggleFilter={toggleFilter}
      />
      <FilterSection
        traitType="Fleet"
        relevant
        values={fleetsValues}
        enabledFilters={filters["Fleet"]}
        toggleFilter={toggleFilter}
      />
      {attributeSections.map((trait) => {
        const key = trait as keyof typeof traitValuesByType;
        return (
          <FilterSection
            key={`FilterSection:${trait}`}
            traitType={trait}
            relevant
            values={traitValuesByType[key]}
            enabledFilters={filters[trait]}
            toggleFilter={toggleFilter}
          />
        );
      })}
      <FilterPanelHeading>In-flight</FilterPanelHeading>
      <AccordionItemWithSwitch
        title="Is in-flight"
        value={flightTimeFilters.isInFlight}
        toggleValue={() => toggleFlightTimeFilter("isInFlight")}
      />
      <AccordionItemWithSwitch
        title="Is trained"
        value={flightTimeFilters.isTrained}
        toggleValue={() => toggleFlightTimeFilter("isTrained")}
      />
      <FilterPanelHeading>Parts</FilterPanelHeading>
      {partsSections.map(([trait, relevantFleets]) => {
        const key = trait as keyof typeof traitValuesByType;
        const fleetFilters = filters["Fleet"];

        const relevant =
          !fleetFilters ||
          fleetFilters.size === 0 ||
          overlaps(fleetFilters, new Set(relevantFleets));

        return (
          <FilterSection
            key={`FilterSection:${trait}`}
            traitType={trait}
            relevant={relevant}
            values={traitValuesByType[key]}
            enabledFilters={filters[trait]}
            toggleFilter={toggleFilter}
          />
        );
      })}
    </Accordion>
  );
};

export const ActiveFiltersBar = ({
  filters,
  toggleFilter,
  clearFilters,
  flightTimeFilters,
  setFlightTimeFilters,
}: FiltersComponentProps) => {
  const hasFilters =
    Object.keys(filters).length > 0 ||
    Object.values(flightTimeFilters).some((v) => v);

  const toggleFlightTimeFilter = useCallback(
    (key: keyof FlightTimeFilters) => {
      setFlightTimeFilters((old) => {
        const toggle = old[key];

        let update = { ...old };
        update[key] = !toggle;

        return update;
      });
    },
    [setFlightTimeFilters]
  );

  return (
    <Flex gap={2} align="center" wrap="wrap">
      <Text textTransform="uppercase" as="b">
        Active Filters:
      </Text>
      {Object.keys(filters).map((attribute, i) => {
        return (
          <React.Fragment key={`FilterBarFragment${i}`}>
            {Array.from(filters[attribute]).map((v) => (
              <Tag key={`Chip:${attribute}:${v}`} size="lg">
                <TagLabel>{`${attribute}: ${v}`}</TagLabel>
                <TagCloseButton onClick={() => toggleFilter(attribute, v)} />
              </Tag>
            ))}
          </React.Fragment>
        );
      })}
      {flightTimeFilters.isInFlight && (
        <Tag size="lg">
          <TagLabel>Is in-flight</TagLabel>
          <TagCloseButton
            onClick={() => toggleFlightTimeFilter("isInFlight")}
          />
        </Tag>
      )}
      {flightTimeFilters.isTrained && (
        <Tag size="lg">
          <TagLabel>Is trained</TagLabel>
          <TagCloseButton onClick={() => toggleFlightTimeFilter("isTrained")} />
        </Tag>
      )}
      {hasFilters ? (
        <Button
          onClick={() => {
            clearFilters();
            setFlightTimeFilters((_) => {
              return DEFAULT_FLIGHT_TIME_FILTERS;
            });
          }}
          color="primary"
          variant="ghost"
          size="sm"
        >
          Clear All
        </Button>
      ) : (
        <Text color="inactive">None</Text>
      )}
    </Flex>
  );
};

const RigGridItem = ({ rig }: { rig: Rig }) => {
  const { currentPilot, ...rest } = rig;
  return (
    <RouterLink
      to={`/rigs/${rig.id}`}
      style={{ position: "relative", display: "block", textDecoration: "none" }}
    >
      <VStack _hover={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
        <RigDisplay rig={rest} borderRadius="3px" />
        <Text>
          Rig #{rig.id} ({currentPilot ? "In-flight" : "Parked"})
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
          p={GRID_GAP}
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
                    <Heading as="h4" fontWeight="bold">
                      <AccordionButton px="0" fontSize="2xl" fontWeight="bold">
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
                  <Heading as="h4" fontWeight="bold" mb={10}>
                    Filters
                  </Heading>
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
                  return (
                    <GridItem key={index}>
                      <RigGridItem rig={rig} />
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
