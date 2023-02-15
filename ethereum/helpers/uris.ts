export function getURITemplate(
  tablelandHost: string,
  attributesTable: string,
  dealsTable: string,
  lookupsTable: string,
  pilotsTable: string,
  displayAttributes: boolean
): string[] {
  if (!displayAttributes) {
    const uri =
      tablelandHost +
      "/query?extract=true&unwrap=true&s=" +
      encodeURIComponent(
        `select json_object(
          'name','Rig #'||rig_id,
          'external_url','https://garage.tableland.xyz/rigs/'||rig_id,
          'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name,
          'image_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,
          'image_medium','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name,
          'image_medium_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,
          'thumb','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name,
          'thumb_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,
          'animation_url',animation_base_url||rig_id||'.html',
          'attributes',json_array(
            json_object(
              'trait_type','status',
              'value','pre-reveal'
            )
          )
        ) from ${attributesTable} join ${lookupsTable} where rig_id=ID group by rig_id;`.replace(
          /(\r\n|\n|\r|\s\s+)/gm,
          ""
        )
      );
    return uri.split("ID");
  } else {
    const uri =
      tablelandHost +
      "/query?extract=true&unwrap=true&s=" +
      encodeURIComponent(
        `select json_object(
          'name','Rig #'||rig_id,
          'external_url','https://garage.tableland.xyz/rigs/'||rig_id,
          'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name,
          'image_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,
          'image_medium','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name,
          'image_medium_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,
          'thumb','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name,
          'thumb_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,
          'animation_url',animation_base_url||rig_id||'.html',
          'attributes',json_insert(
            (
              select json_group_array(
                json_object('display_type',display_type,'trait_type',trait_type,'value',value)
              )
              from ${attributesTable} where rig_id=ID group by rig_id
            ),
            '$[#]',
            json_object(
              'display_type','string',
              'trait_type','Garage Status',
              'value',coalesce(
                (select coalesce(end_time, 'in-flight') from ${pilotsTable} where rig_id=ID and end_time is null),
                'parked'
              )
            ),
            '$[#]',
            json_object(
              'display_type','string',
              'trait_type','Deal 1',
              'value',filecoin_base_url||deal_1
            ),
            '$[#]',
            json_object(
              'display_type','string',
              'trait_type','Deal 2',
              'value',filecoin_base_url||deal_2
            )
          )
        ) from ${attributesTable} join (
          select
            max(case label when 'renders_cid' then value end) renders_cid,
            max(case label when 'layers_cid' then value end) layers_cid,
            max(case label when 'image_full_name' then value end) image_full_name,
            max(case label when 'image_full_alpha_name' then value end) image_full_alpha_name,
            max(case label when 'image_medium_name' then value end) image_medium_name,
            max(case label when 'image_medium_alpha_name' then value end) image_medium_alpha_name,
            max(case label when 'image_thumb_name' then value end) image_thumb_name,
            max(case label when 'image_thumb_alpha_name' then value end) image_thumb_alpha_name,
            max(case label when 'animation_base_url' then value end) animation_base_url,
            max(case label when 'filecoin_base_url' then value end) filecoin_base_url
          from ${lookupsTable}
        ) join (
          select
            max(case deal_number when 1 then deal_id end) deal_1,
            max(case deal_number when 2 then deal_id end) deal_2
          from ${dealsTable}
        ) where rig_id=ID group by rig_id;`.replace(/(\r\n|\n|\r|\s\s+)/gm, "")
      );
    return uri.split("ID");
  }
}

export function getContractURI(
  tablelandHost: string,
  contractTable: string
): string {
  return (
    tablelandHost +
    "/query?extract=true&unwrap=true&s=" +
    encodeURIComponent(
      `select json_object(
        'name',name,
        'description',description,
        'image',image,
        'external_link',external_link,
        'seller_fee_basis_points',seller_fee_basis_points,
        'fee_recipient',fee_recipient
      ) from ${contractTable} limit 1;`.replace(/(\r\n|\n|\r|\s\s+)/gm, "")
    )
  );
}
