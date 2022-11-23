import React from "react";
import { useAccount } from "wagmi";
import { connection } from "../hooks/useTablelandConnection";

export const AccountWatcher = () => {
  useAccount({
    onDisconnect() {
      connection.token = undefined;
    },
  });

  return null;
};
