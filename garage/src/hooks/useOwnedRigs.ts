import { useCallback, useEffect, useState } from "react";
import { useContractRead } from "wagmi";
import { RigWithPilots } from "~/types";
import { selectRigs } from "~/utils/queries";
import { isValidAddress, as0xString } from "~/utils/types";
import { mainChain, deployment } from "~/env";
import { abi } from "~/abis/TablelandRigs";
import { useTablelandConnection } from "./useTablelandConnection";

const { contractAddress } = deployment;

export const useOwnedRigs = (address?: string) => {
  const { db } = useTablelandConnection();

  const { data } = useContractRead({
    chainId: mainChain.id,
    address: as0xString(contractAddress),
    abi,
    functionName: "tokensOfOwner",
    args: isValidAddress(address) ? [address] : undefined,
    enabled: !!address,
  });

  const [rigs, setRigs] = useState<RigWithPilots[]>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;
    if (address && data) {
      const ids = data.map((bn) => bn.toString());

      db.prepare(selectRigs(ids))
        .all<RigWithPilots>()
        .then(({ results }) => {
          if (!isCancelled) setRigs(results);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [address, data, setRigs, /* effect dep */ shouldRefresh]);

  return { rigs, refresh };
};
