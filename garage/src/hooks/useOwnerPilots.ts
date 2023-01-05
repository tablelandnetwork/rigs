import { useEffect, useState } from "react";
import { selectOwnerPilots } from "../utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";
import { Pilot } from "../types";

export interface PilotWithFT extends Pilot {
  flightTime: number;
  isActive: boolean;
}

export const useOwnerPilots = (owner?: string, currentBlockNumber?: number) => {
  const { connection: tableland } = useTablelandConnection();

  const [pilots, setPilots] = useState<PilotWithFT[]>();

  useEffect(() => {
    if (!owner || !currentBlockNumber) return;

    let isCancelled = false;

    tableland
      .read(selectOwnerPilots(owner, currentBlockNumber))
      .then((result) => {
        if (isCancelled) return;

        setPilots(
          result.rows.map(([contract, tokenId, flightTime, isActive]) => {
            return { contract, tokenId, flightTime, isActive };
          })
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [owner, currentBlockNumber, setPilots]);

  return { pilots };
};
