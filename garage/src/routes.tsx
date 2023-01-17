import React from "react";
import { Enter } from "./pages/Enter";
import { Dashboard } from "./pages/Dashboard";
import { RigDetails } from "./pages/RigDetails";
import { OwnerDetails } from "./pages/OwnerDetails";

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
  ];
};
