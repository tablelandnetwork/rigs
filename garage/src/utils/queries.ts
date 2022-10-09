const RIGS = "rigs_5_28";
const RIGS_ATTRIBUTES = "rig_attributes_5_27";
const RIG_PILOT_SESSIONS = "rig_pilot_sessions_5_787";

export const selectRigs = (ids: string[]): string => {
  return `
  SELECT
    id,
    image,
    image_alpha,
    thumb,
    thumb_alpha,
    json_group_array(json_object(
      'displayType', display_type,
      'traitType', trait_type,
      'value', value
    )) AS attributes
  FROM ${RIGS} AS rigs
  JOIN ${RIGS_ATTRIBUTES} AS attributes ON rigs.id = attributes.rig_id
  WHERE rigs.id IN ('${ids.join("', '")}')
  GROUP BY id`;
};

export const selectRigWithPilots = (id: string): string => {
  return `
  SELECT
    rigs.id,
    image,
    image_alpha,
    thumb,
    thumb_alpha,
    (
      SELECT
        json_group_array(json_object(
          'displayType', display_type,
          'traitType', trait_type,
          'value', value
        ))
      FROM ${RIGS_ATTRIBUTES}
      WHERE rig_id = ${id}
    ) AS attributes,
    (
      SELECT
        json_group_array(json_object(
          'contract', pilot_contract,
          'tokenId', cast(pilot_id as text),
          'startTime', start_time,
          'endTime', end_time
        ))
      FROM ${RIG_PILOT_SESSIONS}
      WHERE rig_id = ${id}
    ) AS piloting_sessions
  FROM ${RIGS} AS rigs
  WHERE rigs.id = ${id}`;
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
    rig_id,
    thumb,
    image,
    pilot_contract,
    pilot_id,
    start_time,
    end_time,
    max(start_time, coalesce(end_time, 0)) as "timestamp"
  FROM ${RIG_PILOT_SESSIONS} AS sessions
  JOIN ${RIGS} AS rigs ON sessions.rig_id = rigs.id
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
    SELECT count(*) FROM
    ${RIGS}
  ) AS num_rigs,
  (
    SELECT count(*) FROM (
      SELECT DISTINCT(rig_id)
      FROM ${RIG_PILOT_SESSIONS}
      WHERE end_time IS NULL
    )
  ) AS num_rigs_in_flight,
  (
    SELECT count(*) FROM (
      SELECT DISTINCT pilot_contract, pilot_id
      FROM ${RIG_PILOT_SESSIONS}
    )
  ) AS num_pilots,
  (
    SELECT sum(coalesce(end_time, ${blockNumber}) - start_time)
    FROM ${RIG_PILOT_SESSIONS}
  ) AS total_flight_time,
  (
    SELECT avg(coalesce(end_time, ${blockNumber}) - start_time)
    FROM ${RIG_PILOT_SESSIONS}
  ) AS avg_flight_time
  FROM ${RIGS}
  LIMIT 1;`;
};
