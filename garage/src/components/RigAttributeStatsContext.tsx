import React, { useContext, useState, useEffect } from "react";
import groupBy from "lodash/groupby";
import mapValues from "lodash/mapvalues";
import { useTablelandConnection } from "../hooks/useTablelandConnection";
import { selectTraitRarities } from "../utils/queries";

interface RigAttributeStats {
  [traitType: string]: { [traitValue: string]: number };
}

const RigAttributeStatsContext = React.createContext<RigAttributeStats | undefined>(
  undefined
);

interface RawResult {
  trait_type: string;
  value: string;
  count: number;
}

export const RigAttributeStatsContextProvider = ({
  children,
}: React.PropsWithChildren) => {
  const { connection } = useTablelandConnection();

  const [traits, setTraits] = useState<RigAttributeStats>();

  useEffect(() => {
    if (!connection) return;

    let isCancelled = false;

    connection.read(selectTraitRarities(), { output: "objects" }).then((v) => {
      if (isCancelled) return;

      setTraits(
        mapValues(
          groupBy((v as unknown) as RawResult[], "trait_type"),
          (traits) =>
            Object.fromEntries(
              traits.map(({ value, count }) => [value, count as number])
            )
        )
      );
    });

    return () => {
      isCancelled = true;
    };
  }, [connection, setTraits]);

  return (
    <RigAttributeStatsContext.Provider value={traits}>
      {children}
    </RigAttributeStatsContext.Provider>
  );
};

export const useRigAttributeStats = () => useContext(RigAttributeStatsContext);
