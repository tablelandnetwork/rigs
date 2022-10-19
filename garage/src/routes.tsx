import React from "react";
import { Enter } from "./pages/Enter";
import { Dashboard } from "./pages/Dashboard";
import { RigDetails } from "./pages/RigDetails";
import { RequiresWalletConnection } from "./components/RequiresWalletConnection";

export const routes = [
  { key: "ENTER", path: "/", element: <Enter /> },
  {
    key: "DASHBOARD",
    path: "/dashboard",
    requiresWalletConnection: true,
    element: <Dashboard />,
  },
  {
    key: "RIG_DETAILS",
    path: "/rigs/:id",
    requiresWalletConnection: true,
    element: <RigDetails />,
  },
];
