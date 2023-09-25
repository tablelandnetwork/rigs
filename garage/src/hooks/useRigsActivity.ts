import { useEffect, useState } from "react";
import { Event, EventAction } from "~/types";
import { selectRigsActivity } from "~/utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";

interface DbEvent {
  rigId: string;
  thumb: string;
  image: string;
  pilot?: { contract: string; tokenId: string };
  action: "piloted" | "parked";
  timestamp: number;
}

const eventFromRow = ({
  rigId,
  thumb,
  image,
  pilot,
  action,
  timestamp,
}: DbEvent): Event => ({
  rigId,
  thumb,
  image,
  pilot,
  action:
    action === "parked"
      ? EventAction.Parked
      : pilot?.contract
      ? EventAction.Piloted
      : EventAction.PilotedTrainer,
  timestamp: timestamp.toString(),
});

export const useRigsActivity = () => {
  const { db } = useTablelandConnection();

  const [events, setEvents] = useState<Event[]>();

  useEffect(() => {
    let isCancelled = false;

    db.prepare(selectRigsActivity([], 40))
      .all<DbEvent>()
      .then(({ results }) => {
        if (!isCancelled) setEvents(results.map(eventFromRow));
      });

    return () => {
      isCancelled = true;
    };
  }, [setEvents]);

  return { events };
};
