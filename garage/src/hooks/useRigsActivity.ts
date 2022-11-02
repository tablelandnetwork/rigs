import { useEffect, useState } from "react";
import { Event } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigsActivity } from "../utils/queries";
import { eventFromRow } from "../utils/xforms";

export const useRigsActivity = () => {
  const { connection: tableland } = useTablelandConnection();

  const [events, setEvents] = useState<Event[]>();

  useEffect(() => {
    let isCancelled = false;

    tableland.read(selectRigsActivity([], 40)).then((result) => {
      if (!isCancelled) setEvents(result.rows.map(eventFromRow));
    });

    return () => {
      isCancelled = true;
    };
  }, [setEvents]);

  return { events };
};
