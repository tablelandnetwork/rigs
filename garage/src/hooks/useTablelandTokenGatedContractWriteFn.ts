import { useCallback } from "react";
import { useContractWrite } from "wagmi";
import { connection } from "./useTablelandConnection";

type ContractWriteFn = ReturnType<typeof useContractWrite>["write"];

export const useTablelandTokenGatedContractWriteFn = (
  write: ContractWriteFn
) => {
  const wrapped = useCallback(async () => {
    const token = await connection.siwe();
    if (token) return write?.();
  }, [write]);

  if (connection.token) return write;

  return wrapped;
};
