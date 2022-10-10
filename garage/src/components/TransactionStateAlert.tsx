import React from "react";
import {
  Alert,
  AlertTitle,
  AlertDescription,
  Box,
  Link,
} from "@chakra-ui/react";
import { useContractWrite } from "wagmi";

type TransactionStateAlertProps = Omit<
  ReturnType<typeof useContractWrite>,
  "reset" | "variables" | "write" | "writeAsync"
>;

export const TransactionStateAlert = ({
  data,
  isIdle,
  isError,
  isLoading,
  isSuccess,
}: TransactionStateAlertProps) => {
  if (isIdle || !data?.hash) return null;

  const etherscanLink = `https://etherscan.io/tx/${data.hash}`;

  const status = isLoading
    ? "info"
    : isSuccess
    ? "success"
    : isError
    ? "error"
    : undefined;

  return (
    <Alert status={status} mt={4}>
      <Box>
        <AlertTitle>
          {isLoading && "Transaction is pending"}
          {isError && "Transaction failed"}
          {isSuccess && "Transaction successful"}
        </AlertTitle>

        <AlertDescription>
          See the transaction on{" "}
          <Link href={etherscanLink} isExternal>
            Etherscan
          </Link>
        </AlertDescription>
      </Box>
    </Alert>
  );
};
