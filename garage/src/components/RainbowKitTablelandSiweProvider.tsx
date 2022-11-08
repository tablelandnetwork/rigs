import React, { useEffect, useMemo, useState } from "react";
import { SiweMessage, generateNonce } from "siwe";
import {
  createAuthenticationAdapter,
  RainbowKitAuthenticationProvider,
  AuthenticationStatus,
} from "@rainbow-me/rainbowkit";
import { connection } from "../hooks/useTablelandConnection";
import { useExpiringLocalStorage } from "../hooks/useLocalStorage";

interface RainbowKitSiweNextAuthProviderProps {
  children: React.ReactNode;
}

interface CachedToken {
  token: string;
  expiresAt: Date;
}

export const RainbowKitTablelandSiweProvider = ({
  children,
}: RainbowKitSiweNextAuthProviderProps) => {
  const [cachedToken, setCachedToken] = useExpiringLocalStorage<CachedToken>(
    "_TABLELAND_TOKEN",
    undefined
  );

  const [status, setStatus] = useState<AuthenticationStatus>("loading");

  useEffect(() => {
    setStatus(cachedToken ? "authenticated" : "unauthenticated");

    if (cachedToken) {
      connection.token = { token: cachedToken.token };
    }
  }, [cachedToken, setStatus]);

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

          setCachedToken({ token, expiresAt: message.expirationTime });

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
