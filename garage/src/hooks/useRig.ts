import { useCallback, useEffect, useState } from "react";
import { RigWithPilots } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigWithPilots } from "../utils/queries";
import { rigWithPilotsFromRow } from "../utils/xforms";

export const useRig = (id: string, currentBlock?: number) => {
  const { connection: tableland } = useTablelandConnection();

  const [rig, setRig] = useState<RigWithPilots>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;

    if (!id || !currentBlock) return;

    tableland.read(selectRigWithPilots(id, currentBlock)).then((result) => {
      const rigs = result.rows.map(rigWithPilotsFromRow);
      if (!isCancelled && rigs.length) setRig(rigs[0]);
    });

    return () => {
      isCancelled = true;
    };
  }, [id, setRig, currentBlock, /* effect dep */ shouldRefresh]);

  return { rig, refresh };
};
