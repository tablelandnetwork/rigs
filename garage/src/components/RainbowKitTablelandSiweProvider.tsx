import React, { useMemo, useState } from "react";
import { SiweMessage, generateNonce } from "siwe";
import {
  createAuthenticationAdapter,
  RainbowKitAuthenticationProvider,
  AuthenticationStatus,
} from "@rainbow-me/rainbowkit";
import { connection } from "../hooks/useTablelandConnection";

interface RainbowKitSiweNextAuthProviderProps {
  children: React.ReactNode;
}

export const RainbowKitTablelandSiweProvider = ({
  children,
}: RainbowKitSiweNextAuthProviderProps) => {
  const [status, setStatus] = useState<AuthenticationStatus>("unauthenticated");
  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => {
          return generateNonce();
        },

        createMessage: ({ nonce, address, chainId }) => {
          const issuedAt = new Date().toISOString();
          const now = Date.now();
          const expirationTime = new Date(
            now + 10 * 60 * 60 * 1000
          ).toISOString(); // Default to ~10 hours

          return new SiweMessage({
            domain: "Tableland",
            address,
            statement: "Official Tableland SDK",
            uri: window.location.origin,
            version: "1",
            chainId,
            nonce,
            issuedAt,
            expirationTime,
          });
        },

        getMessageBody: ({ message }) => {
          return message.prepareMessage();
        },

        verify: async ({ message, signature }) => {
          const token = window.btoa(
            JSON.stringify({
              message: message.toMessage(),
              signature,
            })
          );
          connection.token = { token };

          setStatus("authenticated");

          return true;
        },

        signOut: async () => {},
      }),
    [setStatus]
  );

  return (
    <RainbowKitAuthenticationProvider adapter={adapter} status={status}>
      {children}
    </RainbowKitAuthenticationProvider>
  );
};
