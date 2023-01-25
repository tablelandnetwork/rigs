import { useCallback, useEffect, useState } from "react";
import { RigWithPilots } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigWithPilots } from "../utils/queries";

export const useRig = (id: string) => {
  const { db } = useTablelandConnection();

  const [rig, setRig] = useState<RigWithPilots>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;

    if (!id) return;

    db.prepare(selectRigWithPilots(id))
      .first<RigWithPilots>()
      .then((rig) => {
        if (!isCancelled && rig) setRig(rig);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, setRig, db, /* effect dep */ shouldRefresh]);

  return { rig, refresh };
};
