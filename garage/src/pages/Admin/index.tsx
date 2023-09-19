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
  Table,
  Tr,
  Td,
  Thead,
  Th,
  Tbody,
  HStack,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Database } from "@tableland/sdk";
import { useSigner } from "../../hooks/useSigner";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { Footer } from "../../components/Footer";
import { ChainAwareButton } from "../../components/ChainAwareButton";
import { isValidAddress } from "../../utils/types";
import { CreateMissionModal } from "../../components/CreateMissionModal";
import { CreateProposalModal } from "../../components/CreateProposalModal";
import { useProposals } from "../../hooks/useProposals";
import { useAdminMisisons } from "../../hooks/useMissions";
import { secondaryChain, deployment } from "../../env";
import { useIsAdmin } from "../../hooks/useIsAdmin";

const { ftRewardsTable } = deployment;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
};

const GiveFtRewardForm = (props: React.ComponentProps<typeof Box>) => {
  const toast = useToast();

  const signer = useSigner({ chainId: secondaryChain.id });

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

    try {
      const { meta: insert } = await db
        .prepare(
          `INSERT INTO ${ftRewardsTable} (block_num, recipient, reason, amount) VALUES (BLOCK_NUM(), ?1, ?2, ?3)`
        )
        .bind(form.recipient, form.reason, form.amount)
        .run();

      insert.txn?.wait().then((_) => {
        setIsQuerying(false);
        toast({ title: "Success", status: "success", duration: 7_500 });
      });
    } catch (e) {
      if (e instanceof Error) {
        if (!/user rejected transaction/.test(e.message)) {
          toast({
            title: "Reward failed",
            description: e.message,
            status: "error",
            duration: 7_500,
          });
        }
      }
      setIsQuerying(false);
    }
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

const ListProposalsForm = (props: React.ComponentProps<typeof Box>) => {
  const { proposals } = useProposals();

  const [proposalDialogOpen, setCreateProposalDialogOpen] = useState(false);

  return (
    <>
      <CreateProposalModal
        isOpen={proposalDialogOpen}
        onClose={() => setCreateProposalDialogOpen(false)}
      />
      <Box {...props}>
        <HStack
          justify="space-between"
          align="baseline"
          sx={{ width: "100%", mb: 4 }}
        >
          <Heading>Proposals</Heading>
          <Button onClick={() => setCreateProposalDialogOpen(true)}>
            Create new
          </Button>
        </HStack>
        <Table>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Name</Th>
              <Th>Created At</Th>
              <Th>Starts At</Th>
              <Th>Ends At</Th>
            </Tr>
          </Thead>
          <Tbody>
            {proposals &&
              proposals.map((proposal, i) => (
                <Tr key={i}>
                  <Td>
                    <Link to={`/proposals/${proposal.id}`}>{proposal.id}</Link>
                  </Td>
                  <Td>{proposal.name}</Td>
                  <Td>{proposal.createdAt}</Td>
                  <Td>{proposal.startBlock}</Td>
                  <Td>{proposal.endBlock}</Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
      </Box>
    </>
  );
};

const ListMissionsForm = (props: React.ComponentProps<typeof Box>) => {
  const { missions } = useAdminMisisons();

  const [missionDialogOpen, setMissionDialogOpen] = useState(false);

  return (
    <>
      <CreateMissionModal
        isOpen={missionDialogOpen}
        onClose={() => setMissionDialogOpen(false)}
      />
      <Box {...props}>
        <HStack
          justify="space-between"
          align="baseline"
          sx={{ width: "100%", mb: 4 }}
        >
          <Heading>Missions</Heading>
          <Button onClick={() => setMissionDialogOpen(true)}>Create new</Button>
        </HStack>
        <Table>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Name</Th>
              <Th>Contributions open</Th>
              <Th isNumeric>Contributions needing review</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {missions &&
              missions.map((mission, i) => (
                <Tr key={i}>
                  <Td>
                    <Link to={`/missions/${mission.id}`}>{mission.id}</Link>
                  </Td>
                  <Td>
                    <Link to={`/missions/${mission.id}`}>{mission.name}</Link>
                  </Td>
                  <Td>{(!mission.contributionsDisabled).toString()}</Td>
                  <Td isNumeric>{mission.pendingContributions}</Td>
                  <Td isNumeric>
                    <Link to={`/admin/missions/${mission.id}`}>Manage</Link>
                  </Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
      </Box>
    </>
  );
};

const NoPermissionsForm = ({
  title,
  body,
  ...props
}: { title: string; body: string } & React.ComponentProps<typeof Box>) => {
  return (
    <Box {...props}>
      <Heading>{title}</Heading>
      <Text variant="emptyState" mt={4}>
        {body}
      </Text>
    </Box>
  );
};

export const Admin = () => {
  const { isLoading, data } = useIsAdmin();

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
            {isLoading || !data ? (
              <Spinner />
            ) : (
              <>
                <GiveFtRewardForm {...MODULE_PROPS} />
                {data.votingAdmin ? (
                  <ListProposalsForm {...MODULE_PROPS} />
                ) : (
                  <NoPermissionsForm
                    title="Proposals"
                    body="You don't have the right permissions to manage proposals."
                    {...MODULE_PROPS}
                  />
                )}
                {data.missionsAdin ? (
                  <ListMissionsForm {...MODULE_PROPS} />
                ) : (
                  <NoPermissionsForm
                    title="Missions"
                    body="You don't have the right permissions to manage missions."
                    {...MODULE_PROPS}
                  />
                )}
              </>
            )}
          </Flex>
        </Flex>
      </Flex>
      <Footer />
    </>
  );
};
