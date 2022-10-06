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
