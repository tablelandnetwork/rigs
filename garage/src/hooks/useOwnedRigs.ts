import { useCallback, useEffect, useState } from "react";
import { Rig, isValidAddress } from "../types";
import { useContractRead } from "wagmi";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigs } from "../utils/queries";
import { rigFromRow } from "../utils/xforms";
import { address as contractAddress, abi } from "../contract";

export const useOwnedRigs = (address?: string, currentBlock?: number) => {
  const { connection: tableland } = useTablelandConnection();

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
    if (address && data && currentBlock) {
      const ids = data.map((bn) => bn.toString());

      tableland.read(selectRigs(ids, currentBlock)).then((result) => {
        if (!isCancelled) setRigs(result.rows.map(rigFromRow));
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [address, data, setRigs, currentBlock, /* effect dep */ shouldRefresh]);

  return { rigs, refresh };
};
