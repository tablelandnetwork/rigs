import { useEffect, useMemo, useState } from "react";
import { DelegateCash } from "delegatecash";
import { providers } from "ethers";
import { useAccount as useWagmiAccount } from "wagmi";
import { mainChain, deployment } from "~/env";
import { isPresent } from "~/utils/types";
import { useActingAsAddress } from "~/components/ActingAsAddressContext";

const { id, network } = mainChain;

// NOTE(daniel):
// this is a hack to work around the fact that we always want to use the
// mainChain-chain to look up delegated wallets.
//
// delegate cash uses the default provider (window.ethereum) if none is provided
// and the default provider will switch network automatically when the
// connected wallet switches network. since we sometimes need the wallet
// to be connected to `mainChain` and sometimes to `secondaryChain`
// we expect the rest of the app to work regardless of which chain
// the user is connected to
//
// we also need to overwrite the `getSigner` method since the dc sdk
// always calls getSigner regardless of if it is supported or not
const provider = new providers.AlchemyProvider(
  { chainId: id, name: network },
  import.meta.env.VITE_ALCHEMY_ID
);
provider.getSigner = () => null as any;
const dc = new DelegateCash(provider);

type Flatten<Type> = Type extends Array<infer Item> ? Item : Type;

type Delegation = Flatten<
  Awaited<ReturnType<typeof dc.getDelegationsByDelegate>>
>;

const addressIsEqual = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

export const useAccount = () => {
  const account = useWagmiAccount();

  const { actingAsAddress, setActingAsAddress } = useActingAsAddress();
  const [delegations, setDelegations] = useState<Delegation[]>([]);

  useEffect(() => {
    setDelegations([]);

    if (!account.address) return;

    let isCancelled = false;

    dc.getDelegationsByDelegate(account.address).then((result) => {
      if (!isCancelled) {
        setDelegations(
          result.filter(
            (v) =>
              v.type === "ALL" ||
              (v.type === "CONTRACT" &&
                addressIsEqual(v.contract, deployment.contractAddress))
          )
        );
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [account.address]);

  const result = useMemo(() => {
    let activeActingAddress = actingAsAddress ?? account?.address;

    if (isPresent(actingAsAddress)) {
      if (!delegations.find((v) => addressIsEqual(v.vault, actingAsAddress))) {
        activeActingAddress = account?.address;
      }
    }

    return {
      ...account,
      actingAsAddress: activeActingAddress,
      setActingAsAddress,
      delegations,
    };
  }, [account, actingAsAddress, delegations]);

  return result;
};
