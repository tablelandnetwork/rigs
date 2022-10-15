import { deployments } from "@tableland/rigs/deployments";

const deployment =
  process.env.NODE_ENV === "development"
    ? deployments["polygon-mumbai"]
    : deployments.ethereum;

// TODO(daniel): use this once the data in @tableland/rigs is up to date
// const { attributesTable, lookupsTable, pilotSessionsTable } = deployment;

const attributesTable = "rig_attributes_5_811";
const lookupsTable = "lookups_5_812";
// const pilotSessionsTable = "pilot_sessions_5_813"; // table on goerli
const pilotSessionsTable = "pilot_sessions_80001_3502"; // table on mumbai used by current contract

const IMAGE_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name`;
const IMAGE_ALPHA_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name`;
const THUMB_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name`;
const THUMB_ALPHA_IPFS_URI_SELECT = `'ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name`;

export const selectRigs = (ids: string[]): string => {
  return `
  SELECT
    cast(rig_id as text),
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
    ) AS pilot
  FROM ${attributesTable} AS attributes
  JOIN ${lookupsTable}
  WHERE rig_id IN ('${ids.join("', '")}')
  GROUP BY rig_id`;
};

export const selectRigWithPilots = (id: string): string => {
  return `
  SELECT
    '${id}' as "rig_id",
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
          'contract', pilot_contract,
          'tokenId', cast(pilot_id as text),
          'owner', owner,
          'startTime', start_time,
          'endTime', end_time
        ))
      FROM ${pilotSessionsTable}
      WHERE rig_id = ${id}
    ) AS piloting_sessions
  FROM ${attributesTable}
  JOIN ${lookupsTable}
  WHERE rig_id = ${id}`;
};

// TODO(daniel):
// we want to include both parked and piloted events in the activity log, how do we do that when we don't support unions? we would ideally want to select from the table twice, like this:
//  SELECT *
//  FROM (
//    SELECT rig_id, thumb, image, pilot_contract, pilot_it, start_time as "timestamp", 'piloted' as "type" FROM rig_pilot_sessions_5_787 WHERE end_time IS NULL
//    UNION
//    SELECT rig_id, thumb, image, pilot_contract, pilot_it, end_time as "timestamp", 'parked' as "type" FROM rig_pilot_sessions_5_787 WHERE end_time IS NOT NULL
//  ) AS sessions
//  JOIN rigs_5_28 as rigs ON sessions.rig_id = rigs.id
//  ...
export const selectRigsActivity = (
  rigIds: string[],
  first: number = 20,
  offset: number = 0
): string => {
  const whereClause = rigIds.length
    ? `WHERE rig_id IN (${rigIds.join(",")})`
    : "";

  return `
  SELECT
    cast(rig_id as text),
    ${THUMB_IPFS_URI_SELECT} as "thumb",
    pilot_contract,
    pilot_id,
    start_time,
    end_time,
    max(start_time, coalesce(end_time, 0)) as "timestamp"
  FROM ${pilotSessionsTable} AS sessions
  JOIN ${lookupsTable}
  ${whereClause}
  ORDER BY timestamp DESC
  LIMIT ${first}
  OFFSET ${offset}`;
};

// NOTE(daniel):
// `FROM rigs LIMIT 1` is a hack to support selecting multiple results in one query
export const selectStats = (blockNumber: number): string => {
  return `
  SELECT
  (
    SELECT count(distinct(rig_id)) FROM
    ${attributesTable}
  ) AS num_rigs,
  (
    SELECT count(*) FROM (
      SELECT DISTINCT(rig_id)
      FROM ${pilotSessionsTable}
      WHERE end_time IS NULL
    )
  ) AS num_rigs_in_flight,
  (
    SELECT count(*) FROM (
      SELECT DISTINCT pilot_contract, pilot_id
      FROM ${pilotSessionsTable}
    )
  ) AS num_pilots,
  (
    SELECT coalesce(sum(coalesce(end_time, ${blockNumber}) - start_time), 0)
    FROM ${pilotSessionsTable}
  ) AS total_flight_time,
  (
    SELECT coalesce(avg(coalesce(end_time, ${blockNumber}) - start_time), 0)
    FROM ${pilotSessionsTable}
  ) AS avg_flight_time
  FROM ${attributesTable}
  LIMIT 1;`;
};
