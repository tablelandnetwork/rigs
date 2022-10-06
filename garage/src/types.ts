export interface Attribute {
  display_type: string;
  trait_type: string;
  value: any;
}

export interface Rig {
  id: string;
  image?: string;
  imageAlpha?: string;
  thumb?: string;
  thumbAlpha?: string;
  attributes?: Attribute[];
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
