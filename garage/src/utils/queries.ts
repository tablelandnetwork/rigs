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
      'display_type', display_type,
      'trait_type', trait_type,
      'value', value
    )) AS attributes
  FROM ${RIGS} AS rigs
  JOIN ${RIGS_ATTRIBUTES} AS attributes ON rigs.id = attributes.rig_id
  WHERE rigs.id IN ('${ids.join("', '")}')
  GROUP BY id`;
};

// NOTE(daniel):
// `FROM rigs LIMIT 1` is a hack to support selecting multiple results in one query
export const selectStats = (): string => {
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
    SELECT sum(end_time - start_time)
    FROM ${RIG_PILOT_SESSIONS}
    WHERE end_time IS NOT NULL
  ) AS total_flight_time,
  (
    SELECT avg(end_time - start_time)
    FROM ${RIG_PILOT_SESSIONS}
    WHERE end_time IS NOT NULL
  ) AS avg_flight_time
  FROM ${RIGS}
  LIMIT 1;`;
};
