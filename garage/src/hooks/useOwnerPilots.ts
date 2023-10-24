import { useEffect, useState } from "react";
import { selectOwnerPilots } from "~/utils/queries";
import { Pilot } from "~/types";
import { useTablelandConnection } from "./useTablelandConnection";

export interface PilotWithFT extends Pilot {
  flightTime: number;
  isActive: boolean;
}

export const useOwnerPilots = (owner?: string) => {
  const { db } = useTablelandConnection();

  const [pilots, setPilots] = useState<PilotWithFT[]>();

  useEffect(() => {
    if (!owner) return;

    let isCancelled = false;

    db.prepare(selectOwnerPilots(owner))
      .all<PilotWithFT>()
      .then(({ results }) => {
        if (isCancelled) return;

        setPilots(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [owner, setPilots]);

  return { pilots };
};
