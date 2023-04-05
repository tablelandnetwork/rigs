import React from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
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
          <Box
            display="flex"
            alignItems="center"
            sx={{
              height: size === "small" ? "50px" : "70px",
              minWidth: size === "large" ? "300px" : undefined,
              fontSize: size === "small" ? "16px" : "20px",
            }}
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
                    width="100%"
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
                      <Text color="inactive" whiteSpace="nowrap">
                        {account.displayName}
                      </Text>
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
          </Box>
        );
      }}
    </ConnectButton.Custom>
  );
};

export const MobileNavTablelandConnectButton = ({
  onClick,
}: {
  onClick: () => void;
}) => {
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
                    onClick={() => {
                      onClick();
                      openConnectModal();
                    }}
                    variant="connect"
                    borderRadius="3px"
                    sx={{
                      height: "40px",
                      minWidth: "200px",
                      fontSize: "14px",
                    }}
                  >
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button
                    onClick={() => {
                      onClick();
                      openChainModal();
                    }}
                    color="red"
                  >
                    Wrong network
                  </Button>
                );
              }

              return (
                <Flex align="center" direction="column" color="inactive">
                  <HStack>
                    <Text>Connected as:</Text>
                    <Link to={`/owner/${account.address}`} onClick={onClick}>
                      <Text color="inactive" whiteSpace="nowrap">
                        {account.displayName}
                      </Text>
                    </Link>
                  </HStack>
                  <Button
                    onClick={() => {
                      onClick();
                      openAccountModal();
                    }}
                    variant="outline"
                    borderColor="paper"
                    color="paper"
                    mt={4}
                  >
                    Disconnect
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
