export function getURITemplate(
  tablelandHost: string,
  tokensTable: string,
  attributesTable: string
): string[] {
  if (attributesTable === "") {
    const uri =
      tablelandHost +
      "/query?mode=list&s=" +
      encodeURIComponent(
        `select json_object('name','Rig #'||id,'external_url','https://tableland.xyz/rigs/'||id,'image',image,'image_alpha',image_alpha,'thumb',thumb,'thumb_alpha',thumb_alpha,'attributes',json_group_array(json_object('display_type','string','trait_type','status','value','pre-reveal'))) from ${tokensTable} where id=ID;`
      );
    return uri.split("ID");
  } else {
    const uri =
      tablelandHost +
      "/query?mode=list&s=" +
      encodeURIComponent(
        `select json_object('name','Rig #'||id,'external_url','https://tableland.xyz/rigs/'||id,'image',image,'image_alpha',image_alpha,'thumb',thumb,'thumb_alpha',thumb_alpha,'attributes',json_group_array(json_object('display_type',display_type,'trait_type',trait_type,'value',value))) from ${tokensTable} join ${attributesTable} on ${tokensTable}.id=${attributesTable}.rig_id where id=ID group by id;`
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
    "/query?mode=list&s=" +
    encodeURIComponent(
      `select json_object('name',name,'description',description,'image',image,'external_link',external_link,'seller_fee_basis_points',seller_fee_basis_points,'fee_recipient',fee_recipient) from ${contractTable} limit 1;`
    )
  );
}
