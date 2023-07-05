import { mainChain as chain, deployment } from "../env";

const {
  attributesTable,
  dealsTable,
  ftRewardsTable,
  lookupsTable,
  pilotSessionsTable,
} = deployment;

const IMAGE_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name`;
const IMAGE_ALPHA_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name`;
const THUMB_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name`;
const THUMB_ALPHA_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name`;

const PILOT_TRAINING_DURATION = 172800;

export const selectRigs = (ids: string[]): string => {
  return `
  SELECT
    cast(rig_id as text) as "id",
    ${IMAGE_IPFS_URI_SELECT} as "image",
    ${IMAGE_ALPHA_IPFS_URI_SELECT} as "imageAlpha",
    ${THUMB_IPFS_URI_SELECT} as "thumb",
    ${THUMB_ALPHA_IPFS_URI_SELECT} as "thumbAlpha",
    json_group_array(json_object(
      'displayType', display_type,
      'traitType', trait_type,
      'value', value
    )) AS attributes,
    (
      SELECT json_object(
        'contract', session.pilot_contract,
        'tokenId', cast(session.pilot_id as text)
      )
      FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = attributes.rig_id AND session.end_time IS NULL
    ) AS "currentPilot",
    EXISTS(
      SELECT * FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = attributes.rig_id
      AND (
        (
          session.end_time IS NULL AND
          session.start_time <= (BLOCK_NUM(${
            chain.id
          }) - ${PILOT_TRAINING_DURATION})
        )
        OR
        (session.end_time - session.start_time) >= ${PILOT_TRAINING_DURATION}
      )
    ) AS "isTrained",
    (
      SELECT
        json_group_array(json_object(
          'contract', pilot_contract,
          'tokenId', cast(pilot_id as text),
          'owner', owner,
          'startTime', start_time,
          'endTime', end_time
        ))
      FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = attributes.rig_id
    ) AS "pilotSessions"
  FROM ${attributesTable} AS attributes
  JOIN ${lookupsTable}
  WHERE rig_id IN ('${ids.join("', '")}')
  GROUP BY rig_id`;
};

export const selectRigWithPilots = (id: string): string => {
  return `
  SELECT
    '${id}' as "id",
    ${IMAGE_IPFS_URI_SELECT} as "image",
    ${IMAGE_ALPHA_IPFS_URI_SELECT} as "imageAlpha",
    ${THUMB_IPFS_URI_SELECT} as "thumb",
    ${THUMB_ALPHA_IPFS_URI_SELECT} as "thumbAlpha",
    json_group_array(json_object(
      'displayType', display_type,
      'traitType', trait_type,
      'value', value
    )) as attributes,
    (
      SELECT
        json_group_array(json_object(
          'dealId', deal_id,
          'selector', data_model_selector
        ))
      FROM ${dealsTable} AS deal
      WHERE deal.rig_id = ${id}
    ) as "filecoinDeals",
    (
      SELECT
        json_group_array(json_object(
          'contract', pilot_contract,
          'tokenId', cast(pilot_id as text),
          'owner', owner,
          'startTime', start_time,
          'endTime', end_time
        ))
      FROM ${pilotSessionsTable}
      WHERE rig_id = ${id}
    ) AS "pilotSessions",
    EXISTS(
      SELECT * FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = ${id}
      AND (
        (
          session.end_time IS NULL AND
          session.start_time <= (BLOCK_NUM(${chain.id}) - ${PILOT_TRAINING_DURATION})
        )
        OR
        (session.end_time - session.start_time) >= ${PILOT_TRAINING_DURATION}
      )
    ) AS "isTrained"
  FROM ${attributesTable}
  JOIN ${lookupsTable}
  WHERE rig_id = ${id}`;
};

const selectFilteredRigsActivity = (
  filter: string,
  first: number,
  offset: number = 0
): string => {
  return `
  SELECT
    *,
    ${THUMB_IPFS_URI_SELECT} as "thumb",
    ${IMAGE_IPFS_URI_SELECT} as "image"
  FROM (
    SELECT
      rig_id,
      cast(rig_id as text) as "rigId",
      json_object(
        'contract', pilot_contract,
        'tokenId', pilot_id
      ) as "pilot",
      'piloted' as "action",
      start_time as "timestamp"
    FROM ${pilotSessionsTable}
    WHERE end_time IS NULL ${filter ? `AND ${filter}` : ""}
    UNION
    SELECT
      rig_id,
      cast(rig_id as text) as "rigId",
      null as "pilot",
      'parked' as "action",
      end_time as "timestamp"
    FROM ${pilotSessionsTable}
    WHERE end_time IS NOT NULL ${filter ? `AND ${filter}` : ""}
  )
  JOIN ${lookupsTable}
  ORDER BY timestamp DESC
  LIMIT ${first}
  OFFSET ${offset}`;
};

export const selectRigsActivity = (
  rigIds: string[],
  first: number = 20,
  offset: number = 0
): string => {
  const filter = rigIds.length ? `rig_id IN (${rigIds.join(",")})` : "";

  return selectFilteredRigsActivity(filter, first, offset);
};

export const selectOwnerActivity = (
  owner: string,
  first: number = 20,
  offset: number = 0
): string => {
  return selectFilteredRigsActivity(
    `lower(owner) = '${owner.toLowerCase()}'`,
    first,
    offset
  );
};

export const selectOwnerPilots = (owner: string): string => {
  return `
  SELECT
    pilot_contract as "contract",
    cast(pilot_id as text) as "tokenId",
    sum(coalesce(end_time, BLOCK_NUM(${
      chain.id
    })) - start_time) as "flightTime",
    min(coalesce(end_time, 0)) == 0 as "isActive"
  FROM ${pilotSessionsTable} AS sessions
  JOIN ${lookupsTable}
  WHERE lower(owner) = '${owner.toLowerCase()}'
  GROUP BY pilot_contract, pilot_id
  ORDER BY "flightTime" DESC
  `;
};

// NOTE(daniel):
// `FROM rigs LIMIT 1` is a hack to support selecting multiple results in one query
export const selectStats = (): string => {
  return `
  SELECT
  (
    SELECT count(distinct(rig_id)) FROM
    ${attributesTable}
  ) AS "numRigs",
  (
    SELECT count(*) FROM (
      SELECT DISTINCT(rig_id)
      FROM ${pilotSessionsTable}
      WHERE end_time IS NULL
    )
  ) AS "numRigsInFlight",
  (
    SELECT count(*) FROM (
      SELECT DISTINCT pilot_contract, pilot_id
      FROM ${pilotSessionsTable}
    )
  ) AS "numPilots",
  (
    SELECT coalesce(sum(coalesce(end_time, BLOCK_NUM(${chain.id})) - start_time), 0)
    FROM ${pilotSessionsTable}
  ) AS "totalFlightTime",
  (
    SELECT coalesce(avg(coalesce(end_time, BLOCK_NUM(${chain.id})) - start_time), 0)
    FROM ${pilotSessionsTable}
  ) AS "avgFlightTime"
  FROM ${attributesTable}
  LIMIT 1;`;
};

// NOTE(daniel):
// `FROM rigs LIMIT 1` is a hack to support selecting multiple results in one query
export const selectAccountStats = (address: string): string => {
  const lowerCaseAddress = address.toLowerCase();
  return `
  SELECT
  (
    SELECT count(*) FROM (
      SELECT DISTINCT(rig_id)
      FROM ${pilotSessionsTable}
      WHERE lower(owner) = '${lowerCaseAddress}' AND end_time IS NULL
    )
  ) AS "numRigsInFlight",
  (
    SELECT count(*) FROM (
      SELECT DISTINCT pilot_contract, pilot_id
      FROM ${pilotSessionsTable}
      WHERE lower(owner) = '${lowerCaseAddress}'
    )
  ) AS "numPilots",
  (
    SELECT coalesce(sum(coalesce(end_time, BLOCK_NUM(${chain.id})) - start_time), 0)
    FROM ${pilotSessionsTable}
    WHERE lower(owner) = '${lowerCaseAddress}'
  ) AS "totalFlightTime",
  (
    SELECT coalesce(avg(coalesce(end_time, BLOCK_NUM(${chain.id})) - start_time), 0)
    FROM ${pilotSessionsTable}
    WHERE lower(owner) = '${lowerCaseAddress}'
  ) AS "avgFlightTime"
  FROM ${attributesTable}
  LIMIT 1;`;
};

export const selectTopActivePilotCollections = (): string => {
  return `
  SELECT
    pilot_contract as "contractAddress",
    count(*) as count
  FROM ${pilotSessionsTable}
  WHERE end_time IS NULL AND pilot_contract IS NOT NULL
  GROUP BY pilot_contract
  ORDER BY count DESC`;
};

export const selectTopFtPilotCollections = (): string => {
  return `
  SELECT
    pilot_contract as "contractAddress",
    sum(coalesce(end_time, BLOCK_NUM(${chain.id})) - start_time) as ft
  FROM ${pilotSessionsTable}
  WHERE pilot_contract IS NOT NULL
  GROUP BY pilot_contract
  ORDER BY ft DESC`;
};

export const selectPilotSessionsForPilot = (
  contract: string,
  tokenId: string
): string => {
  return `
  SELECT
    cast(rig_id as text) as "rigId",
    ${THUMB_IPFS_URI_SELECT} as "thumb",
    owner,
    pilot_contract as "pilotContract",
    cast(pilot_id as text) as "pilotId",
    start_time as "startTime",
    end_time as "endTime"
  FROM ${pilotSessionsTable}
  JOIN ${lookupsTable}
  WHERE pilot_contract = '${contract}' AND pilot_id = ${tokenId}
  GROUP BY rig_id`;
};

export const selectActivePilotSessionsForPilots = (
  pilots: { contract: string; tokenId: string }[]
): string => {
  const whereClauses = pilots.map(
    ({ contract, tokenId }) =>
      `(pilot_contract = '${contract}' AND pilot_id = ${tokenId})`
  );

  return `
  SELECT
    cast(rig_id as text) as "rigId",
    owner,
    pilot_contract as "pilotContract",
    cast(pilot_id as text) as "pilotId",
    start_time as "startTime",
    end_time as "endTime"
  FROM ${pilotSessionsTable}
  WHERE (${whereClauses.join(" OR ")}) AND end_time IS NULL;
  `;
};

export const selectTraitRarities = (): string => {
  return `SELECT trait_type, value, count(*) as "count" FROM ${attributesTable} WHERE trait_type NOT IN ('VIN', '% Original') GROUP BY trait_type, value`;
};

export const selectFilteredRigs = (
  attributeFilters: Record<string, Set<string>>,
  filters: { isTrained?: boolean; isInFlight?: boolean },
  limit: number = 20,
  offset: number = 0
): string => {
  let outerQuery = `
  SELECT
    cast(rig_id as text) as "id",
    ${IMAGE_IPFS_URI_SELECT} as "image",
    ${IMAGE_ALPHA_IPFS_URI_SELECT} as "imageAlpha",
    ${THUMB_IPFS_URI_SELECT} as "thumb",
    ${THUMB_ALPHA_IPFS_URI_SELECT} as "thumbAlpha",
    json_group_array(json_object(
      'displayType', display_type,
      'traitType', trait_type,
      'value', value
    )) AS attributes,
    (
      SELECT json_object(
        'contract', session.pilot_contract,
        'tokenId', cast(session.pilot_id as text)
      )
      FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = attributes.rig_id AND session.end_time IS NULL
    ) AS "currentPilot",
    EXISTS(
      SELECT * FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = attributes.rig_id
      AND (
        (
          session.end_time IS NULL AND
          session.start_time <= (BLOCK_NUM(${chain.id}) - ${PILOT_TRAINING_DURATION})
        )
        OR
        (session.end_time - session.start_time) >= ${PILOT_TRAINING_DURATION}
      )
    ) AS "isTrained"
  FROM ${attributesTable} AS attributes
  JOIN ${lookupsTable}
  WHERE rig_id IN (<subquery>)`;

  outerQuery += ` GROUP BY rig_id LIMIT ${limit} OFFSET ${offset}`;

  let subQuery = `SELECT rig_id FROM ${attributesTable} AS attributes`;

  const quoteString = (v: string) => `'${v}'`;
  let clauses: string[] = [];
  for (const [trait, values] of Object.entries(attributeFilters)) {
    const valuesList = Array.from(values).map(quoteString).join(", ");
    const clause = `
    (
      attributes.trait_type = '${trait}' AND
      attributes.value IN (${valuesList})
    )`;
    clauses = [...clauses, clause];
  }

  let whereAdded = false;
  if (clauses.length) {
    whereAdded = true;
    subQuery += ` WHERE (${clauses.join(") OR (")})`;
  }

  if (filters.isTrained) {
    if (!whereAdded) {
      whereAdded = true;
      subQuery += " WHERE ";
    } else {
      subQuery += " AND ";
    }

    subQuery += `EXISTS(
      SELECT * FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = attributes.rig_id
      AND (
        (
          session.end_time IS NULL AND
          session.start_time <= (BLOCK_NUM(${chain.id}) - ${PILOT_TRAINING_DURATION})
        )
        OR
        (session.end_time - session.start_time) >= ${PILOT_TRAINING_DURATION}
      )
    )`;
  }

  if (filters.isInFlight) {
    if (!whereAdded) {
      whereAdded = true;
      subQuery += " WHERE ";
    } else {
      subQuery += " AND ";
    }

    subQuery += `EXISTS(
      SELECT 1
      FROM ${pilotSessionsTable} AS session
      WHERE session.rig_id = attributes.rig_id AND session.end_time IS NULL
    )`;
  }

  subQuery += ` GROUP BY attributes.rig_id`;

  if (clauses.length) {
    subQuery += ` HAVING count(attributes.trait_type) = ${clauses.length}`;
  }

  return `${outerQuery.replace("<subquery>", subQuery)}`;
};

export const selectOwnerFTRewards = (owner: string) => {
  return `SELECT block_num as "blockNum", recipient, reason, amount FROM ${ftRewardsTable} WHERE recipient = '${owner}' ORDER BY block_num DESC`;
};
