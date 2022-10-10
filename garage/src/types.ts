export interface Attribute {
  displayType: string;
  traitType: string;
  value: any;
}

export interface Pilot {
  contract: string;
  tokenId: string;
}

export interface PilotSession extends Pilot {
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
  currentPilot?: Pilot;
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
  pilot?: Pilot;
  timestamp: string;
}
