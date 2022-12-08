import { useCallback, useEffect, useState } from "react";
import { Rig } from "../types";
import { useAccount, useContractRead } from "wagmi";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigs } from "../utils/queries";
import { rigFromRow } from "../utils/xforms";
import { contractAddress, contractInterface } from "../contract";

export const useOwnedRigs = (currentBlock?: number) => {
  const { address } = useAccount();
  const { connection: tableland } = useTablelandConnection();

  const { data } = useContractRead({
    addressOrName: contractAddress,
    contractInterface,
    functionName: "tokensOfOwner",
    args: address,
  });

  const [rigs, setRigs] = useState<Rig[]>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;
    if (data && currentBlock) {
      const ids = data.map((bn) => bn.toString());

      tableland.read(selectRigs(ids, currentBlock)).then((result) => {
        if (!isCancelled) setRigs(result.rows.map(rigFromRow));
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [data, setRigs, currentBlock, /* effect dep */ shouldRefresh]);

  return { rigs, refresh };
};
