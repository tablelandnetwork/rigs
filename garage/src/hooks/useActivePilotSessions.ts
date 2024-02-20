import { useEffect, useState } from "react";
import { PilotSessionWithRigId } from "~/types";
import { selectActivePilotSessionsForPilots } from "~/utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";

export const useActivePilotSessions = (
  pilots: { contract: string; tokenId: string }[]
) => {
  const { db } = useTablelandConnection();

  const [sessions, setSessions] = useState<PilotSessionWithRigId[]>();

  useEffect(() => {
    if (!pilots.length) {
      setSessions([]);
      return;
    }

    let isCancelled = false;

    db.prepare(selectActivePilotSessionsForPilots(pilots))
      .all<PilotSessionWithRigId>()
      .then(({ results }) => {
        if (isCancelled) return;

        setSessions(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [setSessions]);

  return { sessions };
};
