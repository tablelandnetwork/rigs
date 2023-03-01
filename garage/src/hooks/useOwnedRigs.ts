import { useCallback, useEffect, useState } from "react";
import { Rig, isValidAddress } from "../types";
import { useContractRead } from "wagmi";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigs } from "../utils/queries";
import { deployment } from "../env";
import { abi } from "../abis/TablelandRigs";

const { contractAddress } = deployment;

export const useOwnedRigs = (address?: string) => {
  const { db } = useTablelandConnection();

  const { data } = useContractRead({
    address: contractAddress,
    abi,
    functionName: "tokensOfOwner",
    args: isValidAddress(address) ? [address] : undefined,
    enabled: !!address,
  });

  const [rigs, setRigs] = useState<Rig[]>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;
    if (address && data) {
      const ids = data.map((bn) => bn.toString());

      db.prepare(selectRigs(ids))
        .all<Rig>()
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
