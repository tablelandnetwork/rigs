// Convert wagmi/viem `WalletClient` to ethers `Signer`
import * as React from "react";
import { type WalletClient, useWalletClient } from "wagmi";
import { providers, type Signer } from "ethers";

export function walletClientToSigner(walletClient: WalletClient): Signer {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

export function useSigner({ chainId }: { chainId?: number } = {}):
  | Signer
  | undefined {
  const { data: walletClient } = useWalletClient({ chainId });
  return React.useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient]
  );
}
