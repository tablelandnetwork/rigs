import { useEffect, useState } from "react";
import { selectOwnerActivity } from "../utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";
import { Event, EventAction } from "../types";

interface DbEvent {
  rigId: string;
  thumb: string;
  image: string;
  pilotContract: string;
  pilotId: string;
  startTime: number;
  endTime?: number;
  timestamp: number;
}

const eventFromRow = ({
  rigId,
  thumb,
  image,
  pilotContract,
  pilotId,
  endTime,
  timestamp,
}: DbEvent): Event => ({
  rigId,
  thumb,
  image,
  pilot: { contract: pilotContract, tokenId: pilotId },
  action: endTime
    ? EventAction.Parked
    : pilotContract
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
