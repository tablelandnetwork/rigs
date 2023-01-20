import { useEffect, useState } from "react";
import { selectOwnerPilots } from "../utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";
import { Pilot } from "../types";

export interface PilotWithFT extends Pilot {
  flightTime: number;
  isActive: boolean;
}

export const useOwnerPilots = (owner?: string, currentBlockNumber?: number) => {
  const { db } = useTablelandConnection();

  const [pilots, setPilots] = useState<PilotWithFT[]>();

  useEffect(() => {
    if (!owner || !currentBlockNumber) return;

    let isCancelled = false;

    db.prepare(selectOwnerPilots(owner, currentBlockNumber))
      .all<PilotWithFT>()
      .then(({ results }) => {
        if (isCancelled) return;

        setPilots(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [owner, currentBlockNumber, setPilots]);

  return { pilots };
};
