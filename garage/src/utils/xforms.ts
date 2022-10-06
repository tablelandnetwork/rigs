import { Rig, Attribute, Event, EventAction } from "../types";

type RigRow = [string, string, string, string, string, object];

export const rigFromRow = ([
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes,
]: RigRow): Rig => ({
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes: attributes as Attribute[],
});

type EventRow = [string, string, string, string, string, string, string, string];

export const eventFromRow = ([
  rigId,
  thumb,
  image,
  pilotContract,
  pilotId,
  startTime,
  endTime,
  timestamp,
]: EventRow): Event => ({
  rigId,
  thumb,
  image,
  pilot: { contract: pilotContract, id: pilotId },
  action: endTime ? EventAction.Parked : EventAction.PilotedTrainer,
  timestamp,
});
