import { useEffect, useState } from "react";
import { useTablelandConnection } from "./useTablelandConnection";

export const useWaitForTablelandTxn = (
  chainId: number,
  transactionHash: string | undefined,
  onComplete: () => void,
  onCancelled: () => void
) => {
  const { validator } = useTablelandConnection();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (validator && transactionHash) {
      const controller = new AbortController();
      const signal = controller.signal;

      setIsLoading(true);

      validator
        .pollForReceiptByTransactionHash(
          {
            chainId,
            transactionHash,
          },
          { interval: 2000, signal }
        )
        .then((_) => {
          setIsLoading(false);
          onComplete();
        })
        .catch((_) => {
          setIsLoading(false);
          onCancelled();
        });

      return () => {
        setIsLoading(false);
        controller.abort();
      };
    }
  }, [chainId, transactionHash, onComplete, onCancelled]);

  return { isLoading };
};
