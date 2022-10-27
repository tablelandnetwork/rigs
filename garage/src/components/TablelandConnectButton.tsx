import React, { useCallback } from "react";
import {
  Button,
  Flex,
  Image,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useTablelandConnection } from "../hooks/useTablelandConnection";
import exit from "../assets/exit.svg";

export const TablelandConnectButton = ({
  size = "small",
}: {
  size?: "small" | "large";
}) => {
  const showAddress = useBreakpointValue(
    { base: false, sm: true },
    { ssr: false }
  );
  const { connection: tableland } = useTablelandConnection();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain && tableland.token;

        const connect = useCallback(() => {
          if (!mounted) return;

          if (!account || !chain) {
            openConnectModal();
          }

          if (account && chain) {
            tableland.siwe();
          }
        }, [mounted, account, chain, tableland]);

        return (
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button
                    onClick={connect}
                    variant="connect"
                    borderRadius="3px"
                    sx={{
                      height: size === "small" ? "50px" : "70px",
                      minWidth: size === "large" ? "300px" : undefined,
                      fontSize: size === "small" ? "16px" : "20px",
                    }}
                  >
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} color="red">
                    Wrong network
                  </Button>
                );
              }

              return (
                <Flex align="center">
                  {showAddress && (
                    <Text color="inactive">{account.displayName}</Text>
                  )}
                  <Button
                    leftIcon={<Image src={exit} />}
                    onClick={openAccountModal}
                    variant="disconnect"
                    pl={6}
                    pr={0}
                  >
                    Exit
                  </Button>
                </Flex>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
