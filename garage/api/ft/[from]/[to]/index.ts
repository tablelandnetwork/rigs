import { deployments } from "@tableland/rigs/deployments";

export const config = { runtime: "edge" };

const { pilotSessionsTable, ftRewardsTable } = deployments.ethereum;

const getFtQuery = (address: string) => {
  return `
    SELECT SUM(ft) as "ft"
    FROM (
      SELECT (coalesce(end_time, BLOCK_NUM(1)) - start_time) as "ft" FROM ${pilotSessionsTable} WHERE lower(owner) = lower('${address}')
      UNION ALL
      SELECT amount as "ft" FROM ${ftRewardsTable} WHERE lower(recipient) = lower('${address}')
    )`;
};

export default async function (request: Request) {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const url = new URL(request.url);
  const { from, to } = Object.fromEntries(url.searchParams);
  const min = parseInt(from, 10);
  const max = parseInt(to, 10);

  if (isNaN(min)) return new Response(null, { status: 400 });

  const { wallet } = await request.json();

  const query = getFtQuery(wallet);
  const apiUrl = new URL("https://tableland.network/api/v1/query");
  apiUrl.searchParams.set("statement", query);
  apiUrl.searchParams.set("unwrap", "true");

  const result = await fetch(apiUrl.toString());
  const { ft } = await result.json();

  if (!ft) {
    return new Response(null, { status: 404 });
  }

  const success = ft >= min && (isNaN(max) || ft < max);

  return new Response(JSON.stringify({ success }), {
    headers: { "Content-Type": "application/json" },
  });
}
