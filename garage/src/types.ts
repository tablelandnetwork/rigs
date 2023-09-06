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

export interface Proposal {
  id: number;
  name: string;
  createdAt: number;
  startBlock: number;
  endBlock: number;
  descriptionCid: string;
  voterFtReward: number;
  totalFt: number;
}

export interface Option {
  id: number;
  description: string;
}

export interface ProposalWithOptions extends Proposal {
  options: Option[];
}

export enum ProposalStatus {
  Loading = "loading",
  NotOpened = "Not opened",
  Open = "Open",
  Ended = "Ended"
}

export interface MissionDeliverable {
  name: string;
  description: string;
}

export interface MissionReward {
  amount: number;
  currency: string;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  tags: string[];
  deliverables: MissionDeliverable[];
  reward: MissionReward;
  expiresAt?: Date;
}
