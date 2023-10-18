import { useEffect, useState } from "react";
import {
  selectStats,
  selectAccountStats,
  selectTopActivePilotCollections,
  selectTopFtPilotCollections,
} from "~/utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";

export interface Stat {
  name: string;
  value: number;
}

interface DbResult {
  numRigs: number;
  numRigsInFlight: number;
  numPilots: number;
  totalFlightTime: number;
  avgFlightTime: number;
}

export const useStats = () => {
  const { db } = useTablelandConnection();

  const [stats, setStats] = useState<Stat[]>();

  useEffect(() => {
    let isCancelled = false;

    db.prepare(selectStats())
      .first<DbResult>()
      .then((result) => {
        if (isCancelled) return;

        const {
          numRigs,
          numRigsInFlight,
          numPilots,
          totalFlightTime,
          avgFlightTime,
        } = result;

        setStats([
          { name: "Rigs in-flight", value: numRigsInFlight },
          {
            name: "Rigs parked",
            value: numRigs - numRigsInFlight,
          },
          { name: "Num. pilots", value: numPilots },
          { name: "Average FT per flight", value: avgFlightTime },
          { name: "Total FT earned", value: totalFlightTime as number },
          // { name: "Badges earned", value: 0 },
          // { name: "Badges visible", value: 0 },
        ]);
      });

    return () => {
      isCancelled = true;
    };
  }, [setStats]);

  return { stats };
};

export const useAccountStats = (
  address?: string
) => {
  const { db } = useTablelandConnection();

  const [stats, setStats] = useState<Stat[]>();

  useEffect(() => {
    if (!address) return;

    let isCancelled = false;

    db.prepare(selectAccountStats(address))
      .first<Omit<DbResult, "numRigs">>()
      .then((result) => {
        if (isCancelled) return;

        const {
          numRigsInFlight,
          numPilots,
          totalFlightTime,
          avgFlightTime,
        } = result;

        setStats([
          { name: "Rigs in-flight", value: numRigsInFlight },
          { name: "Num. pilots", value: numPilots },
          { name: "Average FT per flight", value: avgFlightTime },
          { name: "Total FT earned", value: totalFlightTime },
        ]);
      });

    return () => {
      isCancelled = true;
    };
  }, [address, setStats]);

  return { stats };
};

interface TopPilotCollection {
  contractAddress: string;
  count: number;
}

export const useTopActivePilotCollections = () => {
  const { db } = useTablelandConnection();

  const [stats, setStats] = useState<TopPilotCollection[]>();

  useEffect(() => {
    let isCancelled = false;

    db.prepare(selectTopActivePilotCollections())
      .all<TopPilotCollection>()
      .then(({ results }) => {
        if (isCancelled) return;

        setStats(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [setStats]);

  return { stats };
};

interface TopPilotFtCollection {
  contractAddress: string;
  ft: number;
}

export const useTopFtPilotCollections = () => {
  const { db } = useTablelandConnection();

  const [stats, setStats] = useState<TopPilotFtCollection[]>();

  useEffect(() => {
    let isCancelled = false;

    db.prepare(selectTopFtPilotCollections())
      .all<TopPilotFtCollection>()
      .then(({ results }) => {
        if (isCancelled) return;

        setStats(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [setStats]);

  return { stats };
};
