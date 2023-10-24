import React, { useContext, useState, useEffect } from "react";
import groupBy from "lodash/groupBy";
import mapValues from "lodash/mapValues";
import { useTablelandConnection } from "~/hooks/useTablelandConnection";
import { selectTraitRarities } from "~/utils/queries";

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
  const { db } = useTablelandConnection();

  const [traits, setTraits] = useState<RigAttributeStats>();

  useEffect(() => {
    if (!db) return;

    let isCancelled = false;

    db.prepare(selectTraitRarities())
      .all<RawResult>()
      .then(({ results }) => {
        if (isCancelled) return;

        setTraits(
          mapValues(
            groupBy(results, "trait_type"),
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
  }, [db, setTraits]);

  return (
    <RigAttributeStatsContext.Provider value={traits}>
      {children}
    </RigAttributeStatsContext.Provider>
  );
};

export const useRigAttributeStats = () => useContext(RigAttributeStatsContext);
