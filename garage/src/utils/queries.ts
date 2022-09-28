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
  FROM rigs_5_28
  JOIN rig_attributes_5_27 ON rigs_5_28.id = rig_attributes_5_27.rig_id
  WHERE rigs_5_28.id IN ('${ids.join("', '")}')
  GROUP BY id`;
};
