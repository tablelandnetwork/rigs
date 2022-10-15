import {
  Rig,
  RigWithPilots,
  Attribute,
  Pilot,
  PilotSession,
  Event,
  EventAction,
} from "../types";

type RigRow = [string, string, string, string, string, object, object];

export const rigFromRow = ([
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes,
  currentPilot,
]: RigRow): Rig => ({
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes: attributes as Attribute[],
  currentPilot: currentPilot as Pilot,
});

type RigWithPilotsRow = [
  string,
  string,
  string,
  string,
  string,
  object,
  object
];

export const rigWithPilotsFromRow = ([
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes,
  pilotSessions,
]: RigWithPilotsRow): RigWithPilots => ({
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes: attributes as Attribute[],
  currentPilot: (pilotSessions as PilotSession[]).find(v => !v.endTime),
  pilotSessions: pilotSessions as PilotSession[],
});

type EventRow = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
];

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
  pilot: { contract: pilotContract, tokenId: pilotId },
  action: endTime ? EventAction.Parked : EventAction.PilotedTrainer,
  timestamp,
});