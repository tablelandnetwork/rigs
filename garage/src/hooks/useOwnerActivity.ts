import { useEffect, useState } from "react";
import { selectOwnerActivity } from "~/utils/queries";
import { Event, EventAction } from "~/types";
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
export const useOwnerActivity = (owner?: string) => {
  const { db } = useTablelandConnection();

  const [events, setEvents] = useState<Event[]>();

  useEffect(() => {
    if (!owner) return;

    let isCancelled = false;

    db.prepare(selectOwnerActivity(owner, 100, 0))
      .all<DbEvent>()
      .then(({ results }) => {
        if (isCancelled) return;

        setEvents(results.map(eventFromRow));
      });

    return () => {
      isCancelled = true;
    };
  }, [owner, setEvents]);

  return { events };
};
