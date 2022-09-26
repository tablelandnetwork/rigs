import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";

interface RequiresWalletConnectionProps {
  children: React.ReactNode;
}

export const RequiresWalletConnection = ({
  children,
}: RequiresWalletConnectionProps) => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected) navigate("/");
  }, [isConnected, navigate]);

  return <>{isConnected ? children : null}</>;
};
