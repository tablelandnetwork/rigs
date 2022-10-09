export interface Attribute {
  displayType: string;
  traitType: string;
  value: any;
}

export interface PilotSession {
  contract: string;
  tokenId: string;
  startTime: number;
  endTime?: number;
}

export interface Rig {
  id: string;
  image: string;
  imageAlpha: string;
  thumb: string;
  thumbAlpha: string;
  attributes: Attribute[];
}

export interface RigWithPilots extends Rig {
  pilotSessions: PilotSession[];
}

export enum EventAction {
  PilotedTrainer = "Piloted Trainer",
  Parked = "Parked",
}

export interface Event {
  rigId: string;
  thumb: string;
  image: string;
  action: EventAction;
  pilot?: { contract: string; id: string };
  timestamp: string;
}
