import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useAuthenticationStatus } from "./RainbowKitTablelandSiweProvider";

interface RequiresWalletConnectionProps {
  children: React.ReactNode;
}

export const RequiresWalletConnection = ({
  children,
}: RequiresWalletConnectionProps) => {
  const { isConnected } = useAccount();
  const authStatus = useAuthenticationStatus();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected || authStatus === "unauthenticated") {
      navigate("/");
    }
  }, [isConnected, authStatus, navigate]);

  return <>{isConnected ? children : null}</>;
};
