import { useEffect, useState } from "react";
import { RigWithPilots } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigWithPilots } from "../utils/queries";
import { rigWithPilotsFromRow } from "../utils/xforms";

export const useRig = (id: string) => {
  const { connection: tableland } = useTablelandConnection();

  const [rig, setRig] = useState<RigWithPilots>();

  useEffect(() => {
    let isCancelled = false;

    tableland.read(selectRigWithPilots(id)).then((result) => {
      const rigs = result.rows.map(rigWithPilotsFromRow);
      if (!isCancelled && rigs.length) setRig(rigs[0]);
    });

    return () => {
      isCancelled = true;
    };
  }, [id, setRig]);

  return { rig };
};
