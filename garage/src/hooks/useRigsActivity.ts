import { Rig } from "../types";

enum EventAction {
  PilotedTrainer = "Piloted Trainer",
  Parked = "Parked",
}

interface Event {
  rigId: string;
  thumb: string;
  action: EventAction;
  timestamp: Date;
}

export const useRigsActivity = () => {
  const events: Event[] = [
    {
      rigId: "87",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/1/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
    {
      rigId: "1746",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/6/thumb.png",
      action: EventAction.Parked,
      timestamp: new Date(),
    },
    {
      rigId: "3",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/16/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
    {
      rigId: "720",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/10/thumb.png",
      action: EventAction.Parked,
      timestamp: new Date(),
    },
    {
      rigId: "14",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/8/thumb.png",
      action: EventAction.Parked,
      timestamp: new Date(),
    },
    {
      rigId: "2843",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/3/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
    {
      rigId: "1204",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/13/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
    {
      rigId: "87",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/1/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
    {
      rigId: "1746",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/6/thumb.png",
      action: EventAction.Parked,
      timestamp: new Date(),
    },
    {
      rigId: "3",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/16/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
    {
      rigId: "720",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/10/thumb.png",
      action: EventAction.Parked,
      timestamp: new Date(),
    },
    {
      rigId: "14",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/8/thumb.png",
      action: EventAction.Parked,
      timestamp: new Date(),
    },
    {
      rigId: "2843",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/3/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
    {
      rigId: "1204",
      thumb:
        "ipfs://bafybeib3bbctx2gpuzicibprsa3h3zbusogxplccnlgbtmargfnh7bcria/13/thumb.png",
      action: EventAction.PilotedTrainer,
      timestamp: new Date(),
    },
  ];

  return { events };
};
