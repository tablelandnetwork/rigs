import { useCallback } from "react";
import { connection } from "./useTablelandConnection";

export const useTablelandTokenGatedContractWriteFn = (
  write?: () => void | any
) => {
  const wrapped = useCallback(async () => {
    const token = await connection.siwe();
    if (token) return write?.();
  }, [write]);

  if (connection.token) return write;

  return wrapped;
};
