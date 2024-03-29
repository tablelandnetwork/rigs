import { useEffect, useState } from "react";
import { selectOwnerFTRewards } from "~/utils/queries";
import { FTReward } from "~/types";
import { useTablelandConnection } from "./useTablelandConnection";

export const useOwnerFTRewards = (owner?: string) => {
  const { db } = useTablelandConnection();

  const [rewards, setRewards] = useState<FTReward[]>();

  useEffect(() => {
    if (!owner) return;

    let isCancelled = false;

    db.prepare(selectOwnerFTRewards(owner))
      .all<FTReward>()
      .then(({ results }) => {
        if (isCancelled) return;

        setRewards(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [owner, setRewards]);

  return { rewards };
};
