import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Alert,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Input,
  Progress,
  Spinner,
  Stat,
  StatLabel,
  StatHelpText,
  Table,
  Thead,
  Tbody,
  Td,
  Th,
  Text,
  Tr,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { ChatIcon } from "@chakra-ui/icons";
import {
  useAccount,
  useBlockNumber,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import { strings } from "@helia/strings";
import { CID } from "multiformats/cid";
import { TransactionStateAlert } from "../../components/TransactionStateAlert";
import {
  ProposalStatusBadge,
  proposalStatus,
} from "../../components/ProposalStatusBadge";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { useHelia } from "../../hooks/useHelia";
import { useProposal, Result, Vote } from "../../hooks/useProposal";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { as0xString } from "../../utils/types";
import { ProposalWithOptions, ProposalStatus } from "../../types";
import { deployment } from "../../env";
import { abi } from "../../abis/VotingRegistry";

const {
  proposalsTable,
  optionsTable,
  votesTable,
  ftSnapshotTable,
  votingContractAddress,
} = deployment;

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

const useAddressVotingPower = (
  address: string | undefined,
  proposalId: number | undefined
) => {
  const { db } = useTablelandConnection();

  const [votingPower, setVotingPower] = useState<number>();

  useEffect(() => {
    setVotingPower(undefined);

    // 0 is falsy
    if (!address || proposalId === undefined) return;

    let isCancelled = false;

    db.prepare(
      `SELECT COALESCE(SUM(ft), 0) as "votingPower" FROM ${ftSnapshotTable} WHERE lower(address) = lower('${address}') AND proposal_id = ${proposalId}`
    )
      .first<{ votingPower: number }>()
      .then((result) => {
        if (isCancelled) return;

        setVotingPower(result.votingPower);
      });

    return () => {
      isCancelled = true;
    };
  }, [address, proposalId, setVotingPower]);

  return { votingPower };
};

type ModuleProps = Omit<React.ComponentProps<typeof Box>, "results"> & {
  proposal: ProposalWithOptions;
  results: Result[];
  votes: Vote[];
};

type VoteState = { [key: number]: { weight: number; comment: string } };

const CastVote = ({ proposal, results, ...props }: ModuleProps) => {
  const { address } = useAccount();
  const { votingPower } = useAddressVotingPower(address, proposal.id);

  const { data: blockNumber } = useBlockNumber();
  const [votes, setVotes] = useState<VoteState>({});

  const isEligible = (votingPower ?? 0) > 0;

  const status = useMemo(() => proposalStatus(blockNumber, proposal), [
    blockNumber,
    proposal,
  ]);

  const handleWeightChanged = useCallback(
    (i: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const newWeight = parseInt(event.target.value, 10);
      setVotes((old) => {
        const curr = old[i] ?? {};
        const update = Object.fromEntries([
          [i, { ...curr, weight: isNaN(newWeight) ? 0 : newWeight }],
        ]);
        return { ...old, ...update };
      });
    },
    [setVotes]
  );

  const handleCommentChanged = useCallback(
    (i: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const newComment = event.target.value;
      setVotes((old) => {
        const curr = old[i] ?? {};
        const update = Object.fromEntries([
          [i, { ...curr, comment: newComment }],
        ]);
        return { ...old, ...update };
      });
    },
    [setVotes]
  );

  const weightSum = Object.values(votes).reduce((p, c) => p + c.weight, 0);
  const isValid = weightSum === 100;
  const nonZeroWeights = Object.entries(votes).filter(
    ([_, { weight }]) => weight > 0
  );

  const { config } = usePrepareContractWrite({
    address: as0xString(votingContractAddress),
    abi,
    functionName: "vote",
    args: [
      ethers.BigNumber.from(proposal.id),
      nonZeroWeights.map(([id]) => ethers.BigNumber.from(id)),
      nonZeroWeights.map(([_, { weight }]) => ethers.BigNumber.from(weight)),
      nonZeroWeights.map(([_, { comment }]) => comment ?? ""),
    ],
    enabled: isEligible && status === ProposalStatus.Open && isValid,
  });

  const contractWrite = useContractWrite(config);
  const { write } = contractWrite;

  const isMobile = useBreakpointValue(
    { base: true, lg: false },
    { ssr: false }
  );

  return (
    <VStack align="stretch" spacing={4} {...props}>
      <Heading>Cast your vote</Heading>
      <Box pb={8}>
        <Text>
          This proposal uses <i>weighted voting</i> which means that you can
          vote on multiple options by assigning a % of your total voting power
          to an option. The sum must add up to 100.
        </Text>
        {votingPower && (
          <Alert status="info" mt={4}>
            Your voting power in this proposal is {prettyNumber(votingPower)} FT
          </Alert>
        )}
      </Box>
      {isEligible && (
        <Table>
          <Thead>
            <Tr>
              <Th>Option</Th>
              <Th>% of votes</Th>
              {!isMobile && <Th>Comment (optional)</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {proposal.options.map(({ id, description }) => {
              const weight = votes[id]?.weight || 0;
              const comment = weight > 0 ? votes[id].comment : "";

              return (
                <React.Fragment key={`option-${id}`}>
                  <Tr
                    key={`option-${id}`}
                    sx={{ "> td": isMobile ? { borderBottom: "none" } : {} }}
                  >
                    <Td>{description}</Td>
                    <Td width="100px">
                      <Input
                        value={weight === 0 ? "" : weight}
                        placeholder="0%"
                        onChange={(e) => handleWeightChanged(id, e)}
                        type="number"
                      />
                    </Td>
                    {!isMobile && (
                      <Td>
                        <Input
                          type="text"
                          placeholder="Comment"
                          value={comment}
                          isDisabled={weight === 0}
                          onChange={(e) => handleCommentChanged(id, e)}
                        />
                      </Td>
                    )}
                  </Tr>
                  {isMobile && (
                    <Tr>
                      <Td colSpan={2} pt="0">
                        <Input
                          type="text"
                          placeholder="Comment"
                          value={comment}
                          isDisabled={weight === 0}
                          onChange={(e) => handleCommentChanged(id, e)}
                        />
                      </Td>
                    </Tr>
                  )}
                </React.Fragment>
              );
            })}
          </Tbody>
        </Table>
      )}
      <Box width="100%">
        {!isEligible && (
          <Text pb={8}>You are not eligible to vote in this proposal.</Text>
        )}
        <TransactionStateAlert {...contractWrite} />
        {nonZeroWeights.length > 0 && !isValid && (
          <Alert status="error" mb={4}>
            Incorrect vote distribution. The sum must be 100%, you have assigned{" "}
            {weightSum}%.
          </Alert>
        )}
        <Button
          mt={2}
          isDisabled={status !== ProposalStatus.Open || !isValid}
          onClick={write}
          width="100%"
        >
          Vote
        </Button>
      </Box>
    </VStack>
  );
};

const Information = ({ proposal, results, p, ...props }: ModuleProps) => {
  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Information</Heading>
      <Table>
        <Tbody>
          <Tr>
            <Td pl={p}>Start block</Td>
            <Td pr={p} isNumeric>
              {proposal.startBlock}
            </Td>
          </Tr>
          <Tr>
            <Td pl={p}>End block</Td>
            <Td pr={p} isNumeric>
              {proposal.endBlock}
            </Td>
          </Tr>
          <Tr>
            <Td pl={p}>Voting Reward</Td>
            <Td pr={p} isNumeric>
              {prettyNumber(proposal.voterFtReward)} FT
            </Td>
          </Tr>
          <Tr>
            <Td pl={p}>Total FT in snapshot</Td>
            <Td pr={p} isNumeric>
              {prettyNumber(proposal.totalFt)} FT
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </VStack>
  );
};

const truncateChoiceString = (s: string, l: number = 80) =>
  s.slice(0, l) + (s.length > l ? "..." : "");

const Votes = ({ proposal, results, votes, p, ...props }: ModuleProps) => {
  const { options } = proposal;

  const optionLookupMap = Object.fromEntries(
    options.map(({ id, description }) => [id, description])
  );

  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Votes ({votes.length})</Heading>
      <Table>
        <Tbody>
          {votes.slice(0, 20).map(({ address, choices, ft }, index) => {
            const choiceString = choices
              .map(
                ({ optionId, weight }) =>
                  `${weight}% for ${optionLookupMap[optionId]}`
              )
              .join(", ");

            const [showComments, setShowComments] = useState(false);

            return (
              <React.Fragment key={`vote-${index}`}>
                <Tr
                  sx={{ "> td": showComments ? { borderBottom: "none" } : {} }}
                >
                  <Td pl={p}>
                    <Link to={`/owner/${address}`}>
                      {truncateWalletAddress(address)}
                    </Link>
                  </Td>
                  <Td
                    textAlign="center"
                    title={choiceString}
                    overflow="hidden"
                    textOverflow="ellipsis"
                  >
                    {truncateChoiceString(choiceString)}
                    {choices.some((v) => v.comment?.length) && (
                      <ChatIcon
                        sx={{ _hover: { cursor: "pointer" } }}
                        marginLeft={2}
                        onClick={() => setShowComments((old) => !old)}
                      />
                    )}
                  </Td>
                  <Td pr={p} isNumeric>
                    {prettyNumber(ft)} FT
                  </Td>
                </Tr>
                {showComments && (
                  <Tr>
                    <Td colSpan={3} px={p}>
                      <Box
                        display="flex"
                        gap="8px"
                        flexDirection={{ base: "column", md: "row" }}
                        flexWrap="wrap"
                      >
                        {choices
                          .filter((choice) => choice.comment)
                          .map((choice, i) => {
                            return (
                              <Stat
                                key={`commment-${i}`}
                                borderRadius="3px"
                                backgroundColor="#0c1818"
                                p="8px"
                              >
                                <StatLabel>
                                  {optionLookupMap[choice.optionId]}
                                </StatLabel>
                                <StatHelpText>{choice.comment}</StatHelpText>
                              </Stat>
                            );
                          })}
                      </Box>
                    </Td>
                  </Tr>
                )}
              </React.Fragment>
            );
          })}
        </Tbody>
        {votes.length === 0 && (
          <Box p={p} pt="2">
            <Text variant="emptyState">No votes.</Text>
          </Box>
        )}
      </Table>
    </VStack>
  );
};

const Results = ({ proposal, results, ...props }: ModuleProps) => {
  const { data: blockNumber } = useBlockNumber();

  const totalResults = results.reduce((acc, { result }) => acc + result, 0);

  const title = useMemo(() => {
    if (proposalStatus(blockNumber, proposal) === ProposalStatus.Open)
      return "Current result";

    return "Result";
  }, [blockNumber, proposal]);

  return (
    <VStack align="stretch" spacing={4} {...props}>
      <Heading>{title}</Heading>
      <Table variant="unstyled">
        <Tbody>
          {results &&
            results.map(({ description, result, optionId }) => {
              const percent = result === 0 ? 0 : (result / totalResults) * 100;
              return (
                <React.Fragment key={`option-${optionId}`}>
                  <Tr px="0">
                    <Td px="0" pb="0">
                      {description}
                    </Td>
                    <Td
                      isNumeric
                      px="0"
                      pb="0"
                      textAlign="end"
                    >{`${prettyNumber(result)} FT - ${Math.round(
                      percent
                    )}%`}</Td>
                  </Tr>
                  <Tr px="0">
                    <Td colSpan={2} px="0">
                      <Progress value={percent} />
                    </Td>
                  </Tr>
                </React.Fragment>
              );
            })}
        </Tbody>
      </Table>
      {results.length === 0 && (
        <Box>
          <Text variant="emptyState">No result.</Text>
        </Box>
      )}
    </VStack>
  );
};

const Header = ({ proposal, results, ...props }: ModuleProps) => {
  const [markdown, setMarkdown] = useState("");

  const { node } = useHelia();
  const s = strings(node);

  useEffect(() => {
    let isCancelled = false;

    try {
      const cid = CID.parse(proposal.descriptionCid);

      // TODO what, how is this incompatible
      s.get(cid as any).then((v) => {
        if (isCancelled) return;

        setMarkdown(v);
      });
    } catch (_) {}

    return () => {
      isCancelled = true;
    };
  }, [proposal.descriptionCid, setMarkdown]);

  return (
    <VStack align="stretch" spacing={1} {...props}>
      <HStack align="center" justify="space-between">
        <Heading size="xl">{proposal.name}</Heading>
        <ProposalStatusBadge proposal={proposal} />
      </HStack>
      <Box paddingTop={6} />
      <Divider />
      <Box paddingTop={6} />
      {markdown && (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      )}
    </VStack>
  );
};

export const Proposal = () => {
  const { id } = useParams();

  const { data: blockNumber } = useBlockNumber();
  const { proposal, votes, results } = useProposal(id);

  const proposalData =
    proposal && votes && results ? { proposal, votes, results } : undefined;

  const status = useMemo(() => proposalStatus(blockNumber, proposal), [
    blockNumber,
    proposal,
  ]);

  return (
    <Flex
      direction="column"
      align="center"
      justify="stretch"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
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
        {proposalData && (
          <>
            <Flex
              direction="column"
              gap={GRID_GAP}
              align="stretch"
              width="100%"
            >
              <Header {...proposalData} {...MODULE_PROPS} />
              {status === ProposalStatus.Open && (
                <CastVote {...proposalData} {...MODULE_PROPS} />
              )}
              <Votes {...proposalData} {...MODULE_PROPS} />
            </Flex>
            <Flex
              direction="column"
              gap={GRID_GAP}
              align="stretch"
              minWidth="380px"
            >
              <Information {...proposalData} {...MODULE_PROPS} />
              <Results {...proposalData} {...MODULE_PROPS} />
            </Flex>
          </>
        )}
      </Flex>
      {!proposal && <Spinner />}
    </Flex>
  );
};
