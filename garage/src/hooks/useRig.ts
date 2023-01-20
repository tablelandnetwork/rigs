import { useCallback, useEffect, useState } from "react";
import { RigWithPilots } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigWithPilots } from "../utils/queries";
import { rigWithPilotsFromRow } from "../utils/xforms";

export const useRig = (id: string, currentBlock?: number) => {
  const { db } = useTablelandConnection();

  const [rig, setRig] = useState<RigWithPilots>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;

    if (!id || !currentBlock) return;

    db.prepare(selectRigWithPilots(id, currentBlock))
      .first<RigWithPilots>()
      .then((rig) => {
        if (!isCancelled && rig) setRig(rig);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, setRig, currentBlock, db, /* effect dep */ shouldRefresh]);

  return { rig, refresh };
};
