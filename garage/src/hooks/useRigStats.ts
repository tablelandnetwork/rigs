import { useEffect, useState } from "react";
import {
  selectStats,
  selectAccountStats,
  selectTopActivePilotCollections,
  selectTopFtPilotCollections,
} from "../utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";

export interface Stat {
  name: string;
  value: number;
}

export const useStats = (currentBlockNumber?: number) => {
  const { connection: tableland } = useTablelandConnection();

  const [stats, setStats] = useState<Stat[]>();

  useEffect(() => {
    if (!currentBlockNumber) return;

    let isCancelled = false;

    tableland.read(selectStats(currentBlockNumber)).then((result) => {
      if (isCancelled) return;

      const [
        numRigs,
        numRigsInFlight,
        numPilots,
        ftTotal,
        ftAvg,
      ] = result.rows[0];

      setStats([
        { name: "Rigs in-flight", value: numRigsInFlight },
        { name: "Rigs parked", value: numRigs - numRigsInFlight },
        { name: "Num. pilots", value: numPilots },
        { name: "Average FT per flight", value: ftAvg },
        { name: "Total FT earned", value: ftTotal },
        // { name: "Badges earned", value: 0 },
        // { name: "Badges visible", value: 0 },
      ]);
    });

    return () => {
      isCancelled = true;
    };
  }, [currentBlockNumber, setStats]);

  return { stats };
};

export const useAccountStats = (
  currentBlockNumber?: number,
  address?: string
) => {
  const { connection: tableland } = useTablelandConnection();

  const [stats, setStats] = useState<Stat[]>();

  useEffect(() => {
    if (!currentBlockNumber || !address) return;

    let isCancelled = false;

    tableland
      .read(selectAccountStats(currentBlockNumber, address))
      .then((result) => {
        if (isCancelled) return;

        const [numRigsInFlight, numPilots, ftTotal, ftAvg] = result.rows[0];

        setStats([
          { name: "Rigs in-flight", value: numRigsInFlight },
          { name: "Num. pilots", value: numPilots },
          { name: "Average FT per flight", value: ftAvg },
          { name: "Total FT earned", value: ftTotal },
        ]);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentBlockNumber, address, setStats]);

  return { stats };
};

export const useTopActivePilotCollections = () => {
  const { connection: tableland } = useTablelandConnection();

  const [stats, setStats] = useState<
    { contractAddress: string; count: number }[]
  >();

  useEffect(() => {
    let isCancelled = false;

    tableland.read(selectTopActivePilotCollections()).then((result) => {
      if (isCancelled) return;

      const data = result.rows.map(([contractAddress, count]) => ({
        contractAddress,
        count,
      }));
      setStats(data);
    });

    return () => {
      isCancelled = true;
    };
  }, [setStats]);

  return { stats };
};

export const useTopFtPilotCollections = (currentBlockNumber?: number) => {
  const { connection: tableland } = useTablelandConnection();

  const [stats, setStats] = useState<
    { contractAddress: string; ft: number }[]
  >();

  useEffect(() => {
    if (!currentBlockNumber) return;

    let isCancelled = false;

    tableland
      .read(selectTopFtPilotCollections(currentBlockNumber))
      .then((result) => {
        if (isCancelled) return;

        const data = result.rows.map(([contractAddress, ft]) => ({
          contractAddress,
          ft,
        }));
        setStats(data);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentBlockNumber, setStats]);

  return { stats };
};
