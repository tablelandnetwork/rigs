// import { ethers, BigNumber } from 'ethers';
import { connect } from '@tableland/sdk';
// import { deployments } from '@tableland/rigs/deployments.js';
// import { TablelandRigs__factory } from '@tableland/rigs/typechain-types/factories/contracts/TablelandRigs__factory.js';

// const chain = 'polygon-mumbai';
// const info = deployments[chain];
// const contractAddress = info.contractAddress;
// const contractABI = TablelandRigs__factory.abi;
// const alchemyApiKey = '2-splbb2E9wDI3v4pYwMB-TWqHu9Xhe2';

// const rigBadgesTableName = 'rig_badges_5_todo';
const attributesTable = 'rig_attributes_80001_3507';
const lookupsTable = 'lookups_80001_3508';
const pilotSessionsTable = 'pilot_sessions_80001_3515';
const ipfsGatewayUri = 'https://nftstorage.link/ipfs/';

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
	const tableland = connect({ chain: 'polygon-mumbai' });

	let rigId = url.pathname;

	// if (!rigId) {
	// 	// the client is asking for an invalid url
	// 	// TODO: should be show a placeholder?
	// 	throw new Error('invalid rig ID');
	// }

	// allow for .html suffix
	const parts = rigId.replace(/^\/|\/$/g, '').split('.');
	rigId = parts[0];

	/*await tableland.read(
    `SELECT * FROM ${rigBadgesTableName} WHERE rig_id = ${rigId};`,
    { output: "objects" }
  );*/
	// TODO: get the badges via tableland
	// const allBadges = [
	// 	'TableLand_Icons-01.svg',
	// 	'TableLand_Icons-02.svg',
	// 	'TableLand_Icons-03.svg',
	// 	'TableLand_Icons-04.svg',
	// 	'TableLand_Icons-05.svg',
	// 	'TableLand_Icons-06.svg'
	// ];

	// TODO: remove this when we are rendering real badge data
	//       until then you can choose a number of badges to show for manual testing,
	//       the max visible as of 2022/10/06 is 11
	// const totalRigBadgesLength = 117;
	// const totalRigBadges = [];
	// for (let i = 0; i < totalRigBadgesLength; i++) {
	// 	totalRigBadges.push(allBadges[Math.floor(Math.random() * 100) % allBadges.length]);
	// }

	// const maxBadges = 11;
	// const badges = [];
	// for (let i = 0; i < maxBadges; i++) {
	// 	// TODO: pick a random image until we have a way to query for badges
	// 	const nextBadge = totalRigBadges[i];
	// 	if (!nextBadge) break;

	// 	badges.push(nextBadge);
	// }

	const stm = `select json_object(
    'image','ipfs://'||renders_cid||'/'||rig_id||'/'||image_medium_name
  ) from ${attributesTable} join ${lookupsTable} where rig_id=${rigId} group by rig_id;`;
	const metadata: any = await tableland.read(stm, {
		output: 'objects',
		extract: true,
		unwrap: true
	});

	let pilot;
	const sessions: any = await tableland.read(
		`SELECT * FROM ${pilotSessionsTable} WHERE rig_id = ${rigId} AND start_time > 0;`,
		{ output: 'objects' }
	);
	if (sessions && sessions.length > 0) {
		pilot = 'trainer_pilot.svg';
	}

	// TODO: comment+uncomment to see different aspects
	//const pilot = "moonbird_pilot_1x2.png";
	//const pilot = "moonbird_pilot_1x5.png";
	//const pilot = "moonbird_pilot_2x1.png";
	//const pilot = "moonbird_pilot_5x1.png";
	// const pilot = 'moonbird_pilot.png';

	// const rigUrl = await getTokenURI(rigId);

	// const res = await fetch(rigUrl);
	// const metadata = await res.json();

	const httpUri = ipfsGatewayUri + metadata.image.slice(7);

	return {
		imageUrl: httpUri,
		badges: [],
		pilot
	};
}

// const getTokenURI = async (tokenId) => {
// 	try {
// 		const provider = new ethers.providers.AlchemyProvider('matic', alchemyApiKey);
// 		const contractInstance = new ethers.Contract(contractAddress, contractABI, provider);

// 		return await contractInstance.tokenURI(BigNumber.from(tokenId));
// 	} catch (err) {
// 		throw err;
// 	}
// };
