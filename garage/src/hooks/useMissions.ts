import { useCallback, useEffect, useState } from "react";
import { Mission, MissionContribution } from "~/types";
import { deployment, secondaryChain } from "~/env";
import { useTablelandConnection } from "./useTablelandConnection";

const { missionsTable, missionContributionsTable } = deployment;

export const useMission = (id?: string) => {
  const { db } = useTablelandConnection();

  const [mission, setMission] = useState<Mission>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    db.prepare(
      `
      SELECT
        id,
        name,
        description,
        tags,
        requirements,
        rewards,
        deliverables,
        contributions_start_block as "contributionsStartBlock",
        contributions_end_block as "contributionsEndBlock",
        max_number_of_contributions as "maxNumberOfContributions",
        contributions_disabled as "contributionsDisabled"
      FROM ${missionsTable} WHERE id = ${id}
      `
    )
      .first<Mission>()
      .then((result) => {
        if (isCancelled) return;

        setMission(result);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, setMission, /* effect dep */ shouldRefresh]);

  return { mission, refresh };
};

type MissionWithAdminInfo = Mission & { pendingContributions: number };

export const useAdminMisisons = () => {
  const { db } = useTablelandConnection();

  const [missions, setMissions] = useState<MissionWithAdminInfo[]>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;

    if (!db) return;
    db.prepare(
      `SELECT
         id,
         name,
         description,
         tags,
         rewards,
         requirements,
         deliverables,
         contributions_start_block as "contributionsStartBlock",
         contributions_end_block as "contributionsEndBlock",
         max_number_of_contributions as "maxNumberOfContributions",
         contributions_disabled as "contributionsDisabled",
         (SELECT count(*) FROM ${missionContributionsTable} WHERE mission_id = missions.id AND accepted IS NULL) as "pendingContributions"
      FROM ${missionsTable} AS missions ORDER BY id DESC`
    )
      .all<MissionWithAdminInfo>()
      .then(({ results }) => {
        if (isCancelled) return;

        setMissions(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [db, setMissions, /* effect dep */ shouldRefresh]);

  return { missions, refresh };
};

export const useOpenMissions = () => {
  const { db } = useTablelandConnection();

  const [missions, setMissions] = useState<Mission[]>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;

    if (!db) return;
    db.prepare(
      `SELECT
         id,
         name,
         description,
         tags,
         rewards,
         requirements,
         deliverables,
         contributions_start_block as "contributionsStartBlock",
         contributions_end_block as "contributionsEndBlock",
         max_number_of_contributions as "maxNumberOfContributions",
         contributions_disabled as "contributionsDisabled"
       FROM ${missionsTable} AS missions
       WHERE
         contributions_disabled = 0 AND
         (contributions_start_block = 0 OR BLOCK_NUM(${secondaryChain.id}) >= contributions_start_block) AND
         (contributions_end_block = 0 OR BLOCK_NUM(${secondaryChain.id}) <= contributions_end_block) AND
         (max_number_of_contributions = 0 OR (SELECT COUNT(*) FROM ${missionContributionsTable} WHERE mission_id = missions.id AND accepted = true) < max_number_of_contributions)
       ORDER BY id DESC`
    )
      .all<Mission>()
      .then(({ results }) => {
        if (isCancelled) return;

        setMissions(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [db, setMissions, /* effect dep */ shouldRefresh]);

  return { missions, refresh };
};

export const useContributions = (
  missionId: string | null | undefined,
  filter: "all" | "filtered",
  connectedAccount?: string
) => {
  const { db } = useTablelandConnection();

  const [contributions, setContributions] = useState<MissionContribution[]>();
  const [shouldRefresh, setShouldRefresh] = useState({});

  const refresh = useCallback(() => {
    setShouldRefresh({});
  }, [setShouldRefresh]);

  useEffect(() => {
    let isCancelled = false;

    if (!db || !missionId) return;

    let query = `SELECT
        id,
        mission_id as "missionId",
        created_at as "createdAt",
        contributor,
        data,
        (CASE
          WHEN accepted IS NULL THEN 'pending_review'
          WHEN accepted = 0 THEN 'rejected'
          ELSE 'accepted' END) as "status",
        acceptance_motivation as "acceptanceMotivation"
       FROM ${missionContributionsTable} WHERE mission_id = ${missionId}`;

    if (filter === "filtered") {
      query += ` AND (accepted IS NOT NULL OR lower(contributor) = lower('${connectedAccount}'))`;
    }

    db.prepare(query)
      .all<MissionContribution>()
      .then(({ results }) => {
        if (isCancelled) return;

        setContributions(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [db, setContributions, /* effect dep */ shouldRefresh]);

  return { contributions, refresh };
};

export const useOwnerContributions = (owner?: string) => {
  const { db } = useTablelandConnection();

  const [contributions, setContributions] = useState<MissionContribution[]>();

  useEffect(() => {
    if (!owner) return;

    let isCancelled = false;

    db.prepare(
      `SELECT
        id,
        mission_id as "missionId",
        created_at as "createdAt",
        contributor,
        data,
        (CASE
          WHEN accepted IS NULL THEN 'pending_review'
          WHEN accepted = 0 THEN 'rejected'
          ELSE 'accepted' END) as "status",
        acceptance_motivation as "acceptanceMotivation"
       FROM ${missionContributionsTable} WHERE lower(contributor) = lower('${owner}') AND accepted = 1`
    )
      .all<MissionContribution>()
      .then(({ results }) => {
        if (isCancelled) return;

        setContributions(results);
      });

    return () => {
      isCancelled = true;
    };
  }, [owner, setContributions]);

  return { contributions };
};
