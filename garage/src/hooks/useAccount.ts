import { useEffect, useMemo, useState } from "react";
import { DelegateCash } from "delegatecash";
import { useAccount as useWagmiAccount } from "wagmi";
import { deployment } from "../env";
import { isPresent } from "../utils/types";
import { useActingAsAddress } from "../components/ActingAsAddressContext";

const dc = new DelegateCash();

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
