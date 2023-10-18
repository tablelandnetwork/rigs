import React, { useCallback, useMemo, useState } from "react";
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
  Heading,
  Input,
  InputGroup,
  InputRightElement,
  Switch,
  Tag,
  TagLabel,
  TagCloseButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { SmallCloseIcon } from "@chakra-ui/icons";
import { useDebounce } from "~/hooks/useDebounce";
import { copySet, toggleInSet, intersection } from "~/utils/set";
import traitData from "~/traits.json";

// TODO can we fetch this data dynamically or does that make the loading experience annoying?
const {
  fleets,
  colors,
  sharedTraits,
  individualTraits,
  traitValuesByType,
} = traitData;

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

export const toggleValue = (
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
    <Text mt={6} mb={2} {...props} fontSize="lg" fontWeight="bold">
      {props.children}
    </Text>
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

export const FilterPanel = ({
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
      <Text fontSize="lg">Active Filters:</Text>
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
