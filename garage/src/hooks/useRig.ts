import { useEffect, useState } from "react";
import { RigWithPilots } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigWithPilots } from "../utils/queries";
import { rigWithPilotsFromRow } from "../utils/xforms";

interface ParkedGarageStatus {
  state: "PARKED";
}

interface ERC721Pilot {
  contract: string;
  tokenId: string;
}

interface FlyingGarageStatus {
  state: "FLYING";
  pilot: ERC721Pilot | "training";
}

type GarageStatus = ParkedGarageStatus | FlyingGarageStatus;

export interface RigWithGarageStatus extends RigWithPilots {
  garageStatus: GarageStatus;
}

const withGarageStatus = (rig: RigWithPilots): RigWithGarageStatus => {
  const activeSession = rig.pilotSessions.find(({ endTime }) => !endTime)

  return {
    ...rig,
    garageStatus: activeSession ? {
      state: "FLYING",
      pilot: activeSession.contract ? activeSession : "training",
    } : { state: "PARKED" },
  };
};

export const useRig = (id: string) => {
  const { connection: tableland } = useTablelandConnection();

  const [rig, setRig] = useState<RigWithGarageStatus>();

  useEffect(() => {
    let isCancelled = false;

    tableland.read(selectRigWithPilots(id)).then((result) => {
      const rigs = result.rows.map(rigWithPilotsFromRow);
      if (!isCancelled && rigs.length) setRig(withGarageStatus(rigs[0]));
    });

    return () => {
      isCancelled = true;
    };
  }, [id, setRig]);

  return { rig };
};
