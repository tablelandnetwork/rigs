export type WalletAddress = `0x${string}`

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

export interface FilecoinDeal {
  dealId: string;
  selector: string;
}

export interface Rig {
  id: string;
  image: string;
  imageAlpha: string;
  thumb: string;
  thumbAlpha: string;
  attributes: Attribute[];
  currentPilot?: Pilot;
  filecoinDeals?: FilecoinDeal[];
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

export interface FTReward {
  blockNum: number;
  recipient: string;
  reason: string;
  amount: number;
}
