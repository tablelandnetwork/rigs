import { useEffect, useState } from "react";
import { selectOwnerActivity } from "../utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";
import { Event } from "../types";
import { eventFromRow } from "../utils/xforms";

export const useOwnerActivity = (owner?: string) => {
  const { connection: tableland } = useTablelandConnection();

  const [events, setEvents] = useState<Event[]>();

  useEffect(() => {
    if (!owner) return;

    let isCancelled = false;

    tableland.read(selectOwnerActivity(owner, 100, 0)).then((result) => {
      if (isCancelled) return;

      setEvents(result.rows.map(eventFromRow));
    });

    return () => {
      isCancelled = true;
    };
  }, [owner, setEvents]);

  return { events };
};
