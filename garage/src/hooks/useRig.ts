import { useEffect, useState } from "react";
import { Rig } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigs } from "../utils/queries";
import { rigFromRow } from "../utils/xforms";

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

export interface RigWithGarageStatus extends Rig {
  garageStatus: GarageStatus;
}

const withFakeGarageStatus = (rig: Rig): RigWithGarageStatus => {
  return {
    ...rig,
    garageStatus: {
      state: "FLYING",
      pilot: { contract: "0x....", tokenId: "1" },
    },
  };
};

export const useRig = (id: string) => {
  const { connection: tableland } = useTablelandConnection();

  const [rig, setRig] = useState<RigWithGarageStatus>();

  useEffect(() => {
    let isCancelled = false;

    tableland.read(selectRigs([id])).then((result) => {
      const rigs = result.rows.map(rigFromRow);
      if (!isCancelled && rigs.length) setRig(withFakeGarageStatus(rigs[0]));
    });

    return () => {
      isCancelled = true;
    };
  }, [id, setRig]);

  return { rig };
};
