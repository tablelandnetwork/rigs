import { useEffect, useState } from "react";
import { selectStats } from "../utils/queries";
import { useBlockNumber } from "wagmi";
import { useTablelandConnection } from "./useTablelandConnection";

interface Stat {
  name: string;
  value: number;
}

export const useStats = () => {
  const { connection: tableland } = useTablelandConnection();
  const { data: blockNumber } = useBlockNumber();

  const [stats, setStats] = useState<Stat[]>();

  useEffect(() => {
    if (!blockNumber) return;

    let isCancelled = false;

    tableland.read(selectStats(blockNumber)).then((result) => {
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
        { name: "Badges earned", value: 0 },
        { name: "Badges visible", value: 0 },
      ]);
    });

    return () => {
      isCancelled = true;
    };
  }, [blockNumber]);

  return { stats };
};
