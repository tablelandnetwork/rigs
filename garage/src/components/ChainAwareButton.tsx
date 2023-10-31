import React, { useCallback } from "react";
import { Button } from "@chakra-ui/react";
import { Chain, useNetwork, useSwitchNetwork } from "wagmi";
import { useChainModal } from "@rainbow-me/rainbowkit";
import { mainChain } from "~/env";

export const ChainAwareButton = (
  props: { expectedChain?: Chain } & React.ComponentProps<typeof Button>
) => {
  const { chain } = useNetwork();
  const {
    expectedChain = mainChain,
    children: _children,
    onClick: _onClick,
    ...rest
  } = props;
  const { openChainModal } = useChainModal();
  const { switchNetwork } = useSwitchNetwork({ chainId: expectedChain.id });

  let children = _children;

  const wrongChain = !chain || chain.id !== expectedChain.id;
  if (wrongChain) {
    children = "Wrong network";
  }

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (wrongChain) {
        if (switchNetwork) return switchNetwork();

        if (openChainModal) return openChainModal();
      }

      if (_onClick) return _onClick(event);
    },
    [_onClick, openChainModal, switchNetwork]
  );

  return (
    <Button {...rest} onClick={onClick}>
      {children}
    </Button>
  );
};
