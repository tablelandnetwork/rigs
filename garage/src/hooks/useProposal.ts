import { useEffect, useState } from "react";
import { useTablelandConnection } from "./useTablelandConnection";
import { deployment } from "../env";
import { ProposalWithOptions } from "../types";

const {
  proposalsTable,
  optionsTable,
  votesTable,
  ftSnapshotTable,
} = deployment;

export interface Result {
  optionId: number;
  description: string;
  result: number;
}

export interface Vote {
  address: string;
  ft: number;
  choices: { optionId: string; weight: number; comment?: string }[];
}

export const useProposal = (id: string | undefined) => {
  const { db } = useTablelandConnection();

  const [proposal, setProposal] = useState<ProposalWithOptions>();
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
      json_group_array(json_object('id', options.id, 'description', options.description)) as "options",
      (SELECT COALESCE(SUM(ft), 0) FROM ${ftSnapshotTable} WHERE proposal_id = ${id}) as "totalFt"
      FROM ${proposalsTable} proposal
      JOIN ${optionsTable} options ON proposal.id = options.proposal_id
      WHERE proposal.id = ${id}
      GROUP BY proposal.id, proposal.name, proposal.created_at, proposal.start_block, proposal.end_block`
    )
      .first<ProposalWithOptions>()
      .then((result) => {
        if (isCancelled) return;

        setProposal(result);
      });

    db.prepare(
      `SELECT votes.address, vp.ft, json_group_array(json_object('optionId', votes.option_id, 'weight', votes.weight, 'comment', votes.comment)) as "choices"
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
        options.id as "optionId",
        options.description as description,
        SUM(votes.weight * uwp.ft) / 100 as result
        FROM ${votesTable} votes
        JOIN ${optionsTable} options ON options.id = votes.option_id AND options.proposal_id = votes.proposal_id
        JOIN ${ftSnapshotTable} uwp ON uwp.address = votes.address AND uwp.proposal_id = votes.proposal_id
        WHERE votes.proposal_id = ${id}
        GROUP BY options.id, options.description
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
