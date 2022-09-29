import { useEffect, useState } from "react";
import { Rig } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigs } from "../utils/queries";
import { rigFromRow } from "../utils/xforms";

export const useRig = (id: string) => {
  const { connection: tableland } = useTablelandConnection();

  const [rig, setRig] = useState<Rig>();

  useEffect(() => {
    let isCancelled = false;

    tableland.read(selectRigs([id])).then((result) => {
      const rigs = result.rows.map(rigFromRow);
      if (!isCancelled && rigs.length) setRig(rigs[0]);
    });

    return () => {
      isCancelled = true;
    };
  }, [id, setRig]);

  return { rig };
};
