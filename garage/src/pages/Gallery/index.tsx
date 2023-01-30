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
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  Spinner,
  Switch,
  Tag,
  TagLabel,
  TagCloseButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { SmallCloseIcon } from "@chakra-ui/icons";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigDisplay } from "../../components/RigDisplay";
import { Rig } from "../../types";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { selectFilteredRigs } from "../../utils/queries";
import { copySet, toggleInSet, intersection } from "../../utils/set";
import twitterMark from "../../assets/twitter-mark.svg";
import openseaMark from "../../assets/opensea-mark.svg";
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

const FilterSection = ({
  traitType,
  relevant,
  values,
  enabledFilters,
  toggleFilter,
}: FilterSectionProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredValues = useMemo(() => {
    return values.filter((v) =>
      v.value.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.value.localeCompare(b.value));
  }, [values, searchQuery]);

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
};

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

const FilterPanel = ({ filters, toggleFilter }: FiltersComponentProps) => {
  const toggleOriginalOnlyFilter = useCallback(() => {
    toggleFilter("% Original", "100");
  }, [toggleFilter]);

  const originalOnlyEnabled = !!filters["% Original"]?.has("100");

  return (
    <Flex {...MODULE_PROPS} width="300px" flexShrink="0">
      <Accordion allowMultiple defaultIndex={[]} width="100%">
        <Heading as="h4" fontWeight="bold" mb={10}>
          Filters
        </Heading>
        <FilterPanelHeading>Properties</FilterPanelHeading>
        <AccordionItem>
          <Heading as="h4">
            <AccordionButton
              px="0"
              onClick={(e) => {
                toggleOriginalOnlyFilter();
                e.preventDefault();
              }}
            >
              <Box as="span" flex="1" textAlign="left">
                Originals only
              </Box>
              <Switch isChecked={originalOnlyEnabled} />
            </AccordionButton>
          </Heading>
        </AccordionItem>
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
    </Flex>
  );
};

export const ActiveFiltersBar = ({
  filters,
  toggleFilter,
  clearFilters,
}: FiltersComponentProps) => {
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
      {Object.keys(filters).length > 0 && (
        <Button
          onClick={clearFilters}
          color="primary"
          variant="ghost"
          size="sm"
        >
          Clear All
        </Button>
      )}
      {Object.keys(filters).length === 0 && <Text color="inactive">None</Text>}
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
        <Text>Rig #{rig.id} ({currentPilot ? "In-flight" : "Parked"})</Text>
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

  const [rigs, setRigs] = useState<Rig[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [loading, setLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  useEffect(() => {
    setRigs([]);
  }, [filters, setRigs]);

  // Effect that fetches new results when filters change
  useEffect(() => {
    setLoading(true);
    db.prepare(selectFilteredRigs(filters, PAGE_LIMIT, 0))
      .all<Rig>()
      .then((v) => {
        setLoading(false);
        setRigs((oldRigs) => [...oldRigs, ...v.results]);
        setAllLoaded(v.results.length < PAGE_LIMIT);
      });
  }, [db, filters, setRigs]);

  // Callback that is called to load more results for the current filters
  const loadMore = useCallback(() => {
    if (db) {
      setLoading(true);
      db.prepare(selectFilteredRigs(filters, PAGE_LIMIT, rigs.length))
        .all<Rig>()
        .then((v) => {
          setLoading(false);
          setRigs((oldRigs) => [...oldRigs, ...v.results]);
          setAllLoaded(v.results.length < PAGE_LIMIT);
        });
    }
  }, [db, filters, rigs, setRigs, setLoading]);

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
          <Heading>Gallery</Heading>
          <Flex
            direction={{ base: "column", lg: "row" }}
            p={GRID_GAP}
            gap={GRID_GAP}
            align={{ base: "stretch", lg: "start" }}
          >
            <FilterPanel
              filters={filters}
              toggleFilter={toggleFilter}
              clearFilters={clearFilters}
            />
            <VStack {...MODULE_PROPS} align="start" flexGrow="1">
              <ActiveFiltersBar
                filters={filters}
                toggleFilter={toggleFilter}
                clearFilters={clearFilters}
              />
              <Grid
                gap={4}
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
                <Box mt={8} mx="auto">
                  <Button
                    size="md"
                    onClick={loadMore}
                    isLoading={loading || rigs.length === 0}
                  >
                    Load more Rigs
                  </Button>
                </Box>
              )}
            </VStack>
          </Flex>
        </Box>
      </Flex>
      <Flex
        position="fixed"
        bottom="0"
        bgColor="paper"
        zIndex="2"
        left="0"
        right="0"
        height="40px"
        justify="center"
        align="center"
        gap={2}
        borderTopColor="bg"
        borderTopWidth="1px"
      >
        <Link
          href="https://twitter.com/tableland__"
          title="Tableland on Twitter"
          isExternal
        >
          <Image src={twitterMark} color="primary" />
        </Link>
        <Link
          href="https://opensea.io/collection/tableland-rigs"
          title="Rigs on OpenSea"
          isExternal
        >
          <Image src={openseaMark} color="primary" />
        </Link>
      </Flex>
    </>
  );
};
