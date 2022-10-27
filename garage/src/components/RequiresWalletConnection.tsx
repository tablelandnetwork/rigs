import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useTablelandConnection } from "../hooks/useTablelandConnection";

interface RequiresWalletConnectionProps {
  children: React.ReactNode;
}

export const RequiresWalletConnection = ({
  children,
}: RequiresWalletConnectionProps) => {
  const { isConnected } = useAccount();
  const { connection: tableland } = useTablelandConnection();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected || !tableland.token) navigate("/");
  }, [isConnected, navigate]);

  return <>{isConnected ? children : null}</>;
};
