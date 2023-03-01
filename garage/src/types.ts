export type WalletAddress = `0x${string}`

export const isValidAddress = (address?: string): address is WalletAddress => {
  return /0x[0-9a-z]{40,40}/i.test(address || "");
};

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
  owner: string;
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
  isTrained: boolean;
}

export interface RigWithPilots extends Rig {
  pilotSessions: PilotSession[];
}

export enum EventAction {
  PilotedTrainer = "Piloted Trainer",
  Piloted = "Piloted",
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

export interface PilotSessionWithRigId extends PilotSession {
  rigId: string;
  thumb: string;
}
