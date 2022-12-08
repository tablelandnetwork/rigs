import { useCallback, useEffect, useState } from "react";
import { PilotSessionWithRigId } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectActivePilotSessionsForPilots } from "../utils/queries";
import { pilotSessionFromRow } from "../utils/xforms";

export const useActivePilotSessions = (
  pilots: { contract: string; tokenId: string }[]
) => {
  const { connection: tableland } = useTablelandConnection();

  const [sessions, setSessions] = useState<PilotSessionWithRigId[]>();

  useEffect(() => {
    let isCancelled = false;

    tableland
      .read(selectActivePilotSessionsForPilots(pilots))
      .then((result) => {
        if (isCancelled) return;

        setSessions(result.rows.map(pilotSessionFromRow));
      });

    return () => {
      isCancelled = true;
    };
  }, [setSessions]);

  return { sessions };
};
