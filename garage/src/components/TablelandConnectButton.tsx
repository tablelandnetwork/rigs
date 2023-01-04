import React from "react";
import {
  Button,
  Flex,
  Image,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
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
        const connected = mounted && account && chain;

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
                    onClick={openConnectModal}
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
                    <Link to={`/owner/${account.address}`}>
                      <Text color="inactive">{account.displayName}</Text>
                    </Link>
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
