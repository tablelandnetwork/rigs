import React from "react";
import { Button } from "@chakra-ui/react";
import { useNetwork } from "wagmi";
import { useChainModal } from "@rainbow-me/rainbowkit";
import { chain as expectedChain } from "../env";

export const ChainAwareButton = (
  props: React.ComponentProps<typeof Button>
) => {
  const { chain } = useNetwork();
  const { children: _children, onClick: _onClick, ...rest } = props;
  const { openChainModal } = useChainModal();

  let children = _children;
  let onClick = _onClick;
  if (!chain || chain.id !== expectedChain.id) {
    children = "Wrong network";
    onClick = openChainModal;
  }

  return (
    <Button {...rest} onClick={onClick}>
      {children}
    </Button>
  );
};
