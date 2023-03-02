import { init, __wasm } from "@tableland/sqlparser";

export async function normalize(sql: string) {
  if (__wasm == null) {
    await init();
  }
  return (await globalThis.sqlparser.normalize(sql)).statements[0];
}

export async function getURITemplate(
  tablelandHost: string,
  attributesTable: string,
  lookupsTable: string,
  pilotsTable: string,
  displayAttributes: boolean
): Promise<string[]> {
  if (!displayAttributes) {
    const uri =
      tablelandHost +
      "/api/v1/query?format=objects&extract=true&unwrap=true&statement=" +
      encodeURIComponent(
        await normalize(
          `select 
            json_object(
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
            )
          from
            ${attributesTable}
            join ${lookupsTable}
          where rig_id=ID
          group by rig_id;`
        )
      );
    return uri.split("ID");
  } else {
    const uri =
      tablelandHost +
      "/api/v1/query?format=objects&extract=true&unwrap=true&statement=" +
      encodeURIComponent(
        await normalize(
          `select
            json_object(
              'name','Rig #'||rig_id,
              'external_url','https://garage.tableland.xyz/rigs/'||rig_id,
              'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_name,
              'image_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,
              'image_medium','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name,
              'image_medium_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,
              'thumb','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_name,
              'thumb_alpha','ipfs://'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,
              'animation_url',animation_base_url||rig_id||'.html',
              'attributes', json_group_array(
                json_object('display_type',display_type,'trait_type',trait_type,'value',value)
              )
            )
          from 
            (
              select *
              from ${attributesTable}
              union
              select
                a.rig_id,
                'string' display_type,
                'Garage Status' trait_type,
                case when start_time is null then 'parked' else 'in-flight' end value
              from
                ${attributesTable} a
                left join (select * from ${pilotsTable} where end_time is null) s on a.rig_id = s.rig_id
            )
            join ${lookupsTable}
          where rig_id=ID
          group by rig_id;`
        )
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
