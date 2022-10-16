import React from "react";
import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
  Link,
  Spinner,
} from "@chakra-ui/react";
import { useContractWrite, useWaitForTransaction } from "wagmi";
import { blockExplorerBaseUrl } from "../env";

type TransactionStateAlertProps = Omit<
  ReturnType<typeof useContractWrite>,
  "reset" | "variables" | "write" | "writeAsync"
>;

export const TransactionStateAlert = (props: TransactionStateAlertProps) => {
  const {
    data,
    isIdle: transactionIdle,
    isLoading: transactionLoading,
    isError: transactionError,
    isSuccess: transactionSuccess,
  } = props;

  if (transactionIdle) return null;

  const {
    isError: waitFailed,
    isLoading: waitLoading,
    data: waitData,
  } = useWaitForTransaction(data);

  const blockExplorerLink = `${blockExplorerBaseUrl}/tx/${data?.hash}`;
  const hasReceipt = !!waitData;

  const isSuccess = hasReceipt ? waitData.status === 1 : false;
  const isError = hasReceipt ? waitData.status === 0 : false;

  const status =
    transactionLoading || waitLoading
      ? "info"
      : transactionError
      ? "warning"
      : waitFailed
      ? "error"
      : isSuccess
      ? "success"
      : isError
      ? "error"
      : undefined;

  return (
    <Alert status={status} mt={4}>
      <Box>
        {(transactionLoading || waitLoading) && <Spinner mr={3} size="xs" />}
        {(isError || isSuccess) && <AlertIcon />}
      </Box>
      <Box>
        <AlertTitle>
          {transactionLoading && "Check your wallet."}
          {transactionError && "Transaction not submitted."}
          {transactionSuccess && waitLoading && "Transaction is pending."}
          {transactionSuccess &&
            waitFailed &&
            "Failed to get transaction status."}
          {transactionSuccess && isError && "Transaction failed."}
          {transactionSuccess && isSuccess && "Transaction successful."}
        </AlertTitle>

        {transactionSuccess && (
          <AlertDescription>
            See the transaction on{" "}
            <Link
              href={blockExplorerLink}
              isExternal
              sx={{ textDecoration: "underline" }}
            >
              Etherscan
            </Link>
          </AlertDescription>
        )}
      </Box>
    </Alert>
  );
};
