export function getURITemplate(
  tablelandHost: string,
  attributesTable: string,
  lookupsTable: string,
  displayAttributes: boolean
): string[] {
  if (!displayAttributes) {
    const uri =
      tablelandHost +
      "/query?extract=true&unwrap=true&s=" +
      encodeURIComponent(
        `select json_object('name','Rig #'||rig_id,'external_url','https://tableland.xyz/rigs/'||rig_id,'image','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_full_name,'image_alpha','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,'image_medium','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_medium_name,'image_medium_alpha','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,'thumb','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_thumb_name,'thumb_alpha','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,'animation_url',animation_base_url||rig_id||'.html','attributes',json_array(json_object('trait_type','status','value','pre-reveal'))) from ${attributesTable} join ${lookupsTable} where rig_id=ID group by rig_id;`
      );
    return uri.split("ID");
  } else {
    const uri =
      tablelandHost +
      "/query?extract=true&unwrap=true&s=" +
      encodeURIComponent(
        `select json_object('name','Rig #'||rig_id,'external_url','https://tableland.xyz/rigs/'||rig_id,'image','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_full_name,'image_alpha','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_full_alpha_name,'image_medium','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_medium_name,'image_medium_alpha','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_medium_alpha_name,'thumb','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_thumb_name,'thumb_alpha','https://nftstorage.link/ipfs/'||renders_cid||'/'||rig_id||'/'||image_thumb_alpha_name,'animation_url',animation_base_url||rig_id||'.html','attributes',json_group_array(json_object('display_type',display_type,'trait_type',trait_type,'value',value))) from ${attributesTable} join ${lookupsTable} where rig_id=ID group by rig_id;`
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
      `select json_object('name',name,'description',description,'image',image,'external_link',external_link,'seller_fee_basis_points',seller_fee_basis_points,'fee_recipient',fee_recipient) from ${contractTable} limit 1;`
    )
  );
}
