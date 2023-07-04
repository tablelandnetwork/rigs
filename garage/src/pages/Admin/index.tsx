import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useToast,
} from "@chakra-ui/react";
import { Database } from "@tableland/sdk";
import { useSigner } from "../../hooks/useSigner";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { Footer } from "../../components/Footer";
import { ChainAwareButton } from "../../components/ChainAwareButton";
import { isValidAddress } from "../../utils/types";
import { secondaryChain, deployment } from "../../env";

const { ftRewardsTable } = deployment;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
};

const GiveFtRewardForm = (props: React.ComponentProps<typeof Box>) => {
  const toast = useToast();

  const signer = useSigner();

  const db = useMemo(() => {
    if (signer) return new Database({ signer });
  }, [signer]);

  const [form, setFormState] = useState<{
    recipient: string;
    reason: string;
    amount: number;
  }>({
    recipient: "",
    reason: "",
    amount: 0,
  });

  const [isQuerying, setIsQuerying] = useState(false);

  const isFormValid = useMemo(() => {
    const { recipient, reason, amount } = form;
    return isValidAddress(recipient) && reason && amount > 0;
  }, [form]);

  const handleRecipientChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((old) => ({ ...old, recipient: event.target.value }));
    },
    [setFormState]
  );

  const handleReasonChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((old) => ({ ...old, reason: event.target.value }));
    },
    [setFormState]
  );

  const handleAmountChange = useCallback(
    (_: string, valueAsNumber: number) => {
      setFormState((old) => ({ ...old, amount: valueAsNumber }));
    },
    [setFormState]
  );

  const onSubmit = useCallback(async () => {
    if (!db) return;

    setIsQuerying(true);

    const { meta: insert } = await db
      .prepare(
        `INSERT INTO ${ftRewardsTable} (block_num, recipient, reason, amount) VALUES (BLOCK_NUM(), ?1, ?2, ?3)`
      )
      .bind(form.recipient, form.reason, form.amount)
      .run();

    insert.txn
      ?.wait()
      .then((_) => {
        setIsQuerying(false);
        toast({ title: "Success", status: "success", duration: 7_500 });
      })
      .catch((e) => {
        setIsQuerying(false);
        toast({
          title: "Reward failed",
          description: e.toString(),
          status: "error",
          duration: 7_500,
        });
      });
  }, [db, form]);

  return (
    <Box {...props}>
      <Heading mb={2}>Give FT Reward</Heading>
      <FormControl>
        <FormLabel>Wallet</FormLabel>
        <Input
          size="md"
          placeholder="0x..."
          onChange={handleRecipientChange}
          value={form.recipient}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Reason</FormLabel>
        <Input
          size="md"
          placeholder="..."
          onChange={handleReasonChange}
          value={form.reason}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Amount</FormLabel>
        <NumberInput value={form.amount} onChange={handleAmountChange} min={10}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </FormControl>
      <Flex justify="flex-end" width="100%" mt={4}>
        <ChainAwareButton
          expectedChain={secondaryChain}
          isDisabled={isQuerying || !isFormValid}
          onClick={onSubmit}
          isLoading={isQuerying}
        >
          Submit
        </ChainAwareButton>
      </Flex>
    </Box>
  );
};

export const Admin = () => {
  return (
    <>
      <Flex
        direction="column"
        align="center"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT} + 40px)`}
        mb="40px"
      >
        <Flex
          direction={{ base: "column", lg: "row" }}
          p={GRID_GAP}
          pt={{ base: GRID_GAP, md: GRID_GAP * 2 }}
          gap={GRID_GAP}
          align={{ base: "stretch", lg: "start" }}
          maxWidth="1385px"
          width="100%"
          minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
        >
          <Flex direction="column" gap={GRID_GAP} align="stretch" width="100%">
            <GiveFtRewardForm {...MODULE_PROPS} />
          </Flex>
        </Flex>
      </Flex>
      <Footer />
    </>
  );
};
