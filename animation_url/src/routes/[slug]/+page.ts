// import { ethers, BigNumber } from 'ethers';
import { connect } from '@tableland/sdk';

const attributesTable = 'rig_attributes_80001_3507';
const lookupsTable = 'lookups_80001_3508';
const pilotSessionsTable = 'pilot_sessions_80001_3515';
const ipfsGatewayUri = 'https://nftstorage.link/ipfs/';

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
	const tableland = connect({ chain: 'polygon-mumbai' });

	// get rig id, allowing for .html suffix
	let rigId = url.pathname;
	const parts = rigId.replace(/^\/|\/$/g, '').split('.');
	rigId = parts[0];

	// get image
	const stm = `select json_object(
    'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name
  ) from ${attributesTable} join ${lookupsTable} where rig_id=${rigId} group by rig_id;`;
	const metadata: any = await tableland.read(stm, {
		output: 'objects',
		extract: true,
		unwrap: true
	});
	const httpUri = ipfsGatewayUri + metadata.image.slice(7);

	// get pilot
	let pilot;
	const sessions: any = await tableland.read(
		`SELECT end_time FROM ${pilotSessionsTable} WHERE rig_id = ${rigId} AND end_time is null;`,
		{ output: 'objects' }
	);
	if (sessions && sessions.length > 0) {
		pilot = 'trainer_pilot.svg';
	}

	return {
		imageUrl: httpUri,
		badges: [],
		pilot
	};
}
