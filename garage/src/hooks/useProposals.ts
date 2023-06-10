import { useCallback, useEffect, useState } from "react";
import { Proposal } from "../types";
import { useTablelandConnection } from "./useTablelandConnection";
import { deployment } from "../env";

const { proposalsTable } = deployment;

export const useProposals = () => {
  const { db } = useTablelandConnection();

  const [proposals, setProposals] = useState<Proposal[]>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;

    if (!db) return;
    db.prepare(
      `SELECT id, name, created_at as "createdAt", start_block as "startBlock", end_block as "endBlock" FROM ${proposalsTable}`
    )
      .all<Proposal>()
      .then(({ results }) => {
        if (isCancelled) return;

        setProposals(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [db, setProposals, /* effect dep */ shouldRefresh]);

  return { proposals, refresh };
};
