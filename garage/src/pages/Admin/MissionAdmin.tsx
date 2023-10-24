import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Spinner,
  Table,
  Text,
  Tr,
  Td,
  Thead,
  Th,
  Tbody,
  Textarea,
  useToast,
  useDisclosure,
} from "@chakra-ui/react";
import {
  useContractRead,
  useContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { useParams, Link as RouterLink } from "react-router-dom";
import { Database, helpers } from "@tableland/sdk";
import { useSigner } from "~/hooks/useSigner";
import { TOPBAR_HEIGHT } from "~/Topbar";
import { Footer } from "~/components/Footer";
import { ChainAwareButton } from "~/components/ChainAwareButton";
import { MissionContribution } from "~/types";
import { truncateWalletAddress } from "~/utils/fmt";
import { as0xString } from "~/utils/types";
import { useMission, useContributions } from "~/hooks/useMissions";
import { secondaryChain, deployment } from "~/env";
import { EditMissionModal } from "~/components/CreateMissionModal";
import { abi } from "~/abis/MissionsManager";

const { missionContributionsTable, missionContractAddress } = deployment;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  contribution?: MissionContribution;
  onTransactionCompleted: () => void;
}

const ReviewContributionModal = ({
  isOpen,
  onClose,
  contribution,
  onTransactionCompleted,
}: ModalProps) => {
  const toast = useToast();
  const signer = useSigner({ chainId: secondaryChain.id });

  const db = useMemo(() => {
    if (signer) return new Database({ signer });
  }, [signer]);

  const rawContributionDataQueryUrl = useMemo(() => {
    const baseUrl = helpers.getBaseUrl(secondaryChain.id);
    const query = `SELECT data FROM ${missionContributionsTable} WHERE id = ${contribution?.id}`;

    return `${baseUrl}/query?statement=${encodeURIComponent(query)}`;
  }, [contribution]);

  const [txnState, setTxnState] = useState<
    "idle" | "querying" | "success" | "fail"
  >("idle");

  const [reason, setReason] = useState("");

  const setContributionAcceptedState = useCallback(
    async (contributionId: number, accepted: boolean, motivation: string) => {
      if (!db || !contributionId || txnState === "querying") return;

      setTxnState("querying");

      try {
        const { meta: insert } = await db
          .prepare(
            `UPDATE ${missionContributionsTable} SET accepted = ?, acceptance_motivation = ? WHERE id = ?`
          )
          .bind(accepted ? 1 : 0, motivation, contributionId)
          .run();

        await insert.txn?.wait();
        setTxnState("success");
        toast({ title: "Success", status: "success", duration: 7_500 });
        if (onTransactionCompleted) onTransactionCompleted();
      } catch (e) {
        if (e instanceof Error) {
          if (!/user rejected transaction/.test(e.message)) {
            toast({
              title: "Update failed",
              description: e.message,
              status: "error",
              duration: 7_500,
            });
            setTxnState("fail");
          } else {
            setTxnState("idle");
          }
        }
      }
    },
    [db, txnState, setTxnState, toast]
  );

  useEffect(() => {
    if (isOpen) {
      setTxnState("idle");
    }
  }, [isOpen, setTxnState]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Review Mission Contribution</ModalHeader>
        <ModalCloseButton />
        {contribution && (
          <>
            <ModalBody>
              <Text mb={4}>Contributor: {contribution.contributor}</Text>
              <Heading mb={2}>Data</Heading>
              {Array.isArray(contribution.data) ? (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Key</Th>
                      <Th>Value</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {contribution.data.map(({ key, value }) => {
                      return (
                        <Tr>
                          <Td>{key}</Td>
                          <Td>{value}</Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              ) : (
                <Alert status="error">
                  <AlertIcon />
                  <AlertTitle>Incorrect data format</AlertTitle>
                  <AlertDescription>
                    <Link href={rawContributionDataQueryUrl} isExternal>
                      Review data
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
              <Heading mt={4} mb={2}>
                Approve/Reject
              </Heading>
              <FormControl>
                <FormLabel>Reason</FormLabel>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={4}>
                <ChainAwareButton
                  color="red"
                  expectedChain={secondaryChain}
                  isDisabled={["querying", "success"].includes(txnState)}
                  onClick={() =>
                    setContributionAcceptedState(contribution.id, false, reason)
                  }
                  isLoading={txnState === "querying"}
                >
                  Reject
                </ChainAwareButton>

                <ChainAwareButton
                  color="green"
                  expectedChain={secondaryChain}
                  isDisabled={["querying", "success"].includes(txnState)}
                  onClick={() =>
                    setContributionAcceptedState(contribution.id, true, reason)
                  }
                  isLoading={txnState === "querying"}
                >
                  Approve
                </ChainAwareButton>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  isDisabled={txnState === "querying"}
                >
                  {txnState === "success" ? "Close" : "Cancel"}
                </Button>
              </HStack>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

const ContributionsTable = ({
  contributions,
  onReviewContribution,
}: {
  contributions: MissionContribution[];
  onReviewContribution: (contribution: MissionContribution) => void;
}) => {
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Id</Th>
          <Th>Contributor</Th>
          <Th>Status</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {contributions &&
          contributions.map((contribution, i) => {
            const { id, contributor, status } = contribution;
            return (
              <Tr key={`contribution-${i}`}>
                <Td>{id}</Td>
                <Td>
                  <RouterLink to={`/owner/${contributor}`}>
                    {truncateWalletAddress(contributor)}
                  </RouterLink>
                </Td>
                <Td>{status}</Td>
                <Td isNumeric>
                  <Button onClick={() => onReviewContribution(contribution)}>
                    {status === "pending_review" ? "Review" : "Update"}
                  </Button>
                </Td>
              </Tr>
            );
          })}

        {!contributions && <Text variant="emptyState">Empty</Text>}
      </Tbody>
    </Table>
  );
};

export const MissionAdmin = () => {
  const { id } = useParams();
  const { mission } = useMission(id);
  const { refresh: refreshContributions, contributions } = useContributions(
    id,
    "all"
  );

  const [reviewContribution, setReviewContribution] =
    useState<MissionContribution>();

  const { data: contributionsDisabled, refetch: refreshContributionsStatus } =
    useContractRead({
      chainId: secondaryChain.id,
      address: as0xString(missionContractAddress),
      abi,
      functionName: "contributionsDisabled",
      args: [BigInt(id ?? "")],
    });

  const { isLoading, isSuccess, write, data } = useContractWrite({
    address: as0xString(missionContractAddress),
    abi,
    functionName: "setContributionsDisabled",
  });
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: data?.hash,
  });

  const disableContributions = useCallback(() => {
    if (write)
      write({
        args: [BigInt(id ?? ""), true],
      });
  }, [write]);

  const enableContributions = useCallback(() => {
    if (write)
      write({
        args: [BigInt(id ?? ""), false],
      });
  }, [write]);

  // Effect that refreshes contribution status
  useEffect(() => {
    if (isSuccess && !isTxLoading) refreshContributionsStatus();
  }, [isSuccess, isTxLoading, refreshContributionsStatus]);

  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <>
      <ReviewContributionModal
        isOpen={!!reviewContribution}
        onClose={() => setReviewContribution(undefined)}
        contribution={reviewContribution}
        onTransactionCompleted={refreshContributions}
      />
      {mission && (
        <EditMissionModal mission={mission} isOpen={isOpen} onClose={onClose} />
      )}
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
          <Flex
            direction="column"
            gap={GRID_GAP}
            align="stretch"
            width="100%"
            {...MODULE_PROPS}
          >
            {!mission || contributionsDisabled === undefined ? (
              <Spinner />
            ) : (
              <>
                <Heading>
                  # {mission.id} – {mission.description}
                </Heading>
                <Divider pt={4} />
                <Button maxWidth="230px" onClick={onOpen}>
                  Edit Mission
                </Button>
                <Heading mt={8}>Contributions</Heading>
                <Heading size="sm">
                  Contributions are:{" "}
                  <b>{contributionsDisabled ? "disabled" : "enabled"}</b>
                </Heading>
                <Button
                  onClick={disableContributions}
                  isDisabled={isLoading || contributionsDisabled}
                  maxWidth="230px"
                >
                  Disable
                </Button>

                <Button
                  onClick={enableContributions}
                  isDisabled={isLoading || !contributionsDisabled}
                  maxWidth="230px"
                >
                  Enable
                </Button>
              </>
            )}
            {contributions && (
              <>
                <Heading mt={8}>Contributions pending review</Heading>
                <ContributionsTable
                  contributions={contributions.filter(
                    ({ status }) => status === "pending_review"
                  )}
                  onReviewContribution={setReviewContribution}
                />
                <Heading mt={8}>Reviewed</Heading>
                <ContributionsTable
                  contributions={contributions.filter(
                    ({ status }) => status !== "pending_review"
                  )}
                  onReviewContribution={setReviewContribution}
                />
              </>
            )}
          </Flex>
        </Flex>
      </Flex>
      <Footer />
    </>
  );
};
