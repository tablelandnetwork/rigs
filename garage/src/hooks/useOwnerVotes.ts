import { useEffect, useState } from "react";
import { selectOwnerVotes } from "../utils/queries";
import { useTablelandConnection } from "./useTablelandConnection";
import { ProposalWithOptions } from "../types";

export interface Vote {
  proposal: Pick<ProposalWithOptions, "id" | "name" | "options">;
  ft: number;
  choices: { optionId: string; weight: number; comment?: string }[];
}

export const useOwnerVotes = (owner?: string) => {
  const { db } = useTablelandConnection();

  const [votes, setVotes] = useState<Vote[]>();

  useEffect(() => {
    if (!owner) return;

    let isCancelled = false;

    db.prepare(selectOwnerVotes(owner))
      .all<Vote>()
      .then(({ results }) => {
        if (isCancelled) return;

        setVotes(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [owner, setVotes]);

  return { votes };
};
