import { useEffect, useState } from "react";
import { useTablelandConnection } from "./useTablelandConnection";
import { deployment } from "../env";

const { ftSnapshotTable } = deployment;

export const useAddressVotingPower = (
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
};;
