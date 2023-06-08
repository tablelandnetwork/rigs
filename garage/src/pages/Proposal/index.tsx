import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Progress,
  Show,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { LinkIcon } from "@chakra-ui/icons";
import {
  useAccount,
  useBlockNumber,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import { useTablelandConnection } from "../../hooks/useTablelandConnection";
import { useHelia } from "../../hooks/useHelia";
import { strings } from "@helia/strings";
import { CID } from "multiformats/cid";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { prettyNumber, truncateWalletAddress } from "../../utils/fmt";
import { as0xString } from "../../utils/types";
import { ProposalWithAlternatives } from "../../types";
import { deployment } from "../../env";
import { abi } from "../../abis/VotingRegistry";

const {
  proposalsTable,
  alternativesTable,
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

interface Result {
  alternativeId: number;
  description: string;
  result: number;
  list: string;
}

interface Vote {
  address: string;
  ft: number;
  choices: { alternative_id: string; weight: number }[];
}

const useProposal = (id: string | undefined) => {
  const { db } = useTablelandConnection();

  const [proposal, setProposal] = useState<ProposalWithAlternatives>();
  const [votes, setVotes] = useState<Vote[]>();
  const [results, setResults] = useState<Result[]>();

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    db.prepare(
      `SELECT
      proposal.id,
      proposal.name,
      description_cid as "descriptionCid",
      created_at as "createdAt",
      start_block as "startBlock",
      end_block as "endBlock",
      voter_ft_reward as "voterFtReward",
      json_group_array(json_object('id', alternatives.id, 'description', alternatives.description)) as "alternatives",
      (SELECT SUM(ft) FROM ${ftSnapshotTable} WHERE proposal_id = ${id}) as "totalFt"
      FROM ${proposalsTable} proposal
      JOIN ${alternativesTable} alternatives ON proposal.id = alternatives.proposal_id
      WHERE proposal.id = ${id}
      GROUP BY proposal.id, proposal.name, proposal.created_at, proposal.start_block, proposal.end_block`
    )
      .first<ProposalWithAlternatives>()
      .then((result) => {
        if (isCancelled) return;

        setProposal(result);
      });

    db.prepare(
      `SELECT votes.address, vp.ft, json_group_array(json_object('alternative_id', votes.alternative_id, 'weight', votes.weight)) as "choices"
        FROM ${votesTable} votes
        JOIN ${ftSnapshotTable} vp ON vp.address = votes.address AND vp.proposal_id = votes.proposal_id
        WHERE votes.proposal_id = ${id} AND votes.weight > 0
        GROUP BY votes.address
        ORDER BY vp.ft DESC`
    )
      .all<Vote>()
      .then(({ results }) => {
        if (isCancelled) return;

        setVotes(results);
      });

    db.prepare(
      `SELECT
        alternatives.id as "alternativeId",
        alternatives.description as description,
        json_group_array(json_object('alternative_id', votes.alternative_id, 'proposal_id', votes.proposal_id, 'weight', votes.weight)) as "list",
        SUM(votes.weight * uwp.ft) / 100 as result
        FROM ${votesTable} votes
        JOIN ${alternativesTable} alternatives ON alternatives.id = votes.alternative_id AND alternatives.proposal_id = votes.proposal_id
        JOIN ${ftSnapshotTable} uwp ON uwp.address = votes.address AND uwp.proposal_id = votes.proposal_id
        WHERE votes.proposal_id = ${id}
        GROUP BY alternatives.id, alternatives.description
        ORDER BY result DESC`
    )
      .all<Result>()
      .then(({ results }) => {
        if (isCancelled) return;

        setResults(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, setProposal]);

  return { proposal, votes, results };
};

const useIsEligibleToVote = (
  address: string | undefined,
  proposalId: number | undefined
) => {
  const { db } = useTablelandConnection();

  const [isEligible, setIsEligible] = useState<boolean>();

  useEffect(() => {
    setIsEligible(undefined);

    // 0 is falsy
    if (!address || proposalId === undefined) return;

    let isCancelled = false;

    db.prepare(
      `SELECT EXISTS(SELECT * FROM ${votesTable} WHERE lower(address) = lower('${address}') AND proposal_id = ${proposalId}) as "isEligible" FROM ${votesTable} LIMIT 1`
    )
      .first<{ isEligible: boolean }>()
      .then((result) => {
        if (isCancelled) return;

        setIsEligible(result.isEligible);
      });

    return () => {
      isCancelled = true;
    };
  }, [address, proposalId, setIsEligible]);

  return { isEligible };
};

type Weights = { [key: number]: number };

const proposalStatus = (
  blockNumber: number | undefined,
  proposal: ProposalWithAlternatives | undefined
) => {
  if (!blockNumber || !proposal) return "loading";

  if (blockNumber < proposal.startBlock) return "Not opened yet";

  if (blockNumber > proposal.endBlock) return "Proposal ended";

  return "open";
};

type ModuleProps = Omit<React.ComponentProps<typeof Box>, "results"> & {
  proposal: ProposalWithAlternatives;
  results: Result[];
  votes: Vote[];
};

const CastVote = ({ proposal, results, p, ...props }: ModuleProps) => {
  const { address } = useAccount();
  const { isEligible } = useIsEligibleToVote(address, proposal.id);

  const { data: blockNumber } = useBlockNumber();
  const [weights, setWeights] = useState<Weights>({});

  const status = useMemo(
    () => proposalStatus(blockNumber, proposal),
    [blockNumber, proposal]
  );

  const handleWeightChanged = useCallback(
    (i: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const newWeight = parseInt(event.target.value, 10);
      setWeights((old) => {
        const update = Object.fromEntries([[i, newWeight]]);
        return { ...old, ...update };
      });
    },
    [setWeights]
  );

  const isValid = Object.values(weights).reduce((p, c) => p + c, 0) === 100;

  const nonZeroWeights = Object.entries(weights).filter(
    ([_, weight]) => weight > 0
  );

  const { config } = usePrepareContractWrite({
    address: as0xString(votingContractAddress),
    abi,
    functionName: "vote",
    args: [
      ethers.BigNumber.from(proposal.id),
      nonZeroWeights.map(([id]) => ethers.BigNumber.from(id)),
      nonZeroWeights.map(([_, weight]) => ethers.BigNumber.from(weight)),
    ],
    enabled: isEligible && status === "open" && isValid,
  });

  const contractWrite = useContractWrite(config);
  const { isLoading, isSuccess, write, reset, data } = contractWrite;
  const { isLoading: isTxLoading } = useWaitForTransaction({
    hash: data?.hash,
  });

  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Cast your vote</Heading>
      {isEligible && (
        <Table>
          <Tbody>
            {proposal.alternatives.map(({ id, description }) => (
              <Tr key={`alternative-${id}`}>
                <Td pl={p}>{description}</Td>
                <Td pr={p}>
                  <Input
                    value={weights[id] || 0}
                    onChange={(e) => handleWeightChanged(id, e)}
                    type="number"
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <Box p={p} width="100%">
        {!isEligible && (
          <Text pb={8}>You are not eligible to vote in this proposal.</Text>
        )}
        <Button
          isDisabled={status !== "open" || !isValid}
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
              {`${prettyNumber(proposal.totalFt)} FT`}
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
  const { alternatives } = proposal;

  const alternativeLookupMap = Object.fromEntries(
    alternatives.map(({ id, description }) => [id, description])
  );

  return (
    <VStack align="stretch" spacing={4} pt={p} {...props}>
      <Heading px={p}>Votes ({votes.length})</Heading>
      <Table>
        <Tbody>
          {votes.slice(0, 20).map(({ address, choices, ft }) => {
            const choiceString = choices
              .map(
                ({ alternative_id, weight }) =>
                  `${weight}% for ${alternativeLookupMap[alternative_id]}`
              )
              .join(", ");

            return (
              <Tr>
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
                </Td>
                <Td pr={p} isNumeric>
                  {prettyNumber(ft)} FT
                </Td>
              </Tr>
            );
          })}
        </Tbody>
        {votes.length === 0 && (
          <Box p={p} pt="2">
            <Text variant="emptyState">
              No votes yet
            </Text>
          </Box>
        )}
      </Table>
    </VStack>
  );
};

const Results = ({ proposal, results, ...props }: ModuleProps) => {
  const { data: blockNumber } = useBlockNumber();
  const status = useMemo(() => {
    if (!blockNumber || !proposal) return "loading";

    return proposalStatus(blockNumber, proposal);
  }, [blockNumber, proposal]);

  const totalResults = results.reduce((acc, { result }) => acc + result, 0);

  const title = useMemo(() => {
    if (status === "open") return "Current result";

    return "Result";
  }, [status]);

  return (
    <VStack align="stretch" spacing={4} {...props}>
      <Heading>{title}</Heading>
      <Table variant="unstyled">
        <Tbody>
          {results &&
            results.map(({ description, result, alternativeId }) => {
              const percent = result === 0 ? 0 : (result / totalResults) * 100;
              return (
                <React.Fragment key={`alternative-${alternativeId}`}>
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
    </VStack>
  );
};

const Header = ({ proposal, results, ...props }: ModuleProps) => {
  const { data: blockNumber } = useBlockNumber();

  const status = useMemo(() => proposalStatus(blockNumber, proposal), [
    blockNumber,
    proposal,
  ]);

  const [markdown, setMarkdown] = useState("");

  const { node } = useHelia();
  const s = strings(node);

  useEffect(() => {
    let isCancelled = false;

    try {
      const cid = CID.parse(proposal.descriptionCid);

      // TODO what how is this incompatible
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
      <Heading>{proposal.name}</Heading>
      <HStack justify="space-between" pb={6}>
        <Badge
          fontSize="1em"
          colorScheme={status === "open" ? "green" : "purple"}
        >
          {status}
        </Badge>
        <Button leftIcon={<LinkIcon />}>Share</Button>
      </HStack>
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

  const status = useMemo(
    () => proposalStatus(blockNumber, proposal),
    [blockNumber, proposal]
  );

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
              {["Not yet open", "open"].includes(status) && (
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