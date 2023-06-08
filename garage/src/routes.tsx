import React from "react";
import { Enter } from "./pages/Enter";
import { Dashboard } from "./pages/Dashboard";
import { RigDetails } from "./pages/RigDetails";
import { PilotDetails } from "./pages/PilotDetails";
import { OwnerDetails } from "./pages/OwnerDetails";
import { Gallery } from "./pages/Gallery";
import { Admin } from "./pages/Admin";
import { Proposals } from "./pages/Proposals";
import { Proposal } from "./pages/Proposal";

export const routes = () => {
  return [
    { key: "ENTER", path: "/", element: <Enter /> },
    {
      key: "DASHBOARD",
      path: "/dashboard",
      requiresWalletConnection: false,
      element: <Dashboard />,
    },
    {
      key: "RIG_DETAILS",
      path: "/rigs/:id",
      requiresWalletConnection: false,
      element: <RigDetails />,
    },
    {
      key: "OWNER_DETAILS",
      path: "/owner/:owner",
      requiresWalletConnection: false,
      element: <OwnerDetails />,
    },
    {
      key: "GALLERY",
      path: "/gallery",
      requiresWalletConnection: false,
      element: <Gallery />,
    },
    {
      key: "PILOT_DETAILS",
      path: "/pilots/:collection/:id",
      requiresWalletConnection: false,
      element: <PilotDetails />,
    },
    {
      key: "ADMIN",
      path: "/admin",
      requiresWalletConnection: true,
      element: <Admin />,
    },
    {
      key: "PROPOSALS",
      path: "/proposals",
      requiresWalletConnection: false,
      element: <Proposals />,
    },
    {
      key: "PROPOSAL",
      path: "/proposals/:id",
      requiresWalletConnection: false,
      element: <Proposal />,
    }
  ];
};
