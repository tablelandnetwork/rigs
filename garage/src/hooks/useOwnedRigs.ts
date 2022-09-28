import { useEffect, useState } from "react";
import { Rig } from "../types";
import { useAccount, useContractRead } from "wagmi";
import { useTablelandConnection } from "./useTablelandConnection";
import { selectRigs } from "../utils/queries";
import { rigFromRow } from "../utils/xforms"

const RIGS_CONTRACT_ADDRESS = "0x8EAa9AE1Ac89B1c8C8a8104D08C045f78Aadb42D";
const contractInterface = [
  "function tokensOfOwner(address) external view returns (uint256[])",
];

export const useOwnedRigs = () => {
  const { address } = useAccount();
  const { connection: tableland } = useTablelandConnection();

  const { data } = useContractRead({
    addressOrName: RIGS_CONTRACT_ADDRESS,
    contractInterface,
    functionName: "tokensOfOwner",
    args: address,
  });

  const [rigs, setRigs] = useState<Rig[]>();

  useEffect(() => {
    let isCancelled = false;
    if (data) {
      const ids = data.map((bn) => bn.toString());

      tableland.read(selectRigs(ids)).then((result) => {
        if (!isCancelled) setRigs(result.rows.map(rigFromRow));
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [data, setRigs]);

  return { rigs };
};
