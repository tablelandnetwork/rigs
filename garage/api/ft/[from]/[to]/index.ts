import { deployments } from "@tableland/rigs/deployments";

export const config = { runtime: "edge" };

const { pilotSessionsTable, ftRewardsTable } = deployments.ethereum;

const isInvalidAddress = (address?: string): boolean => {
  return !/0x[0-9a-z]{40,40}/i.test(address || "");
};

const getFtQuery = (wallets: string[]) => {
  const walletsList = wallets.map((v) => `'${v.toLowerCase()}'`).join(", ");

  return `
    SELECT SUM(ft) as "ft"
    FROM (
      SELECT (coalesce(end_time, BLOCK_NUM(1)) - start_time) as "ft" FROM ${pilotSessionsTable} WHERE lower(owner) IN (${walletsList})
      UNION ALL
      SELECT amount as "ft" FROM ${ftRewardsTable} WHERE lower(recipient) IN (${walletsList})
    )`;
};

export default async function (request: Request) {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const url = new URL(request.url);
  const { from, to } = Object.fromEntries(url.searchParams);
  const min = parseInt(from, 10);
  const max = parseInt(to, 10);

  if (isNaN(min)) return new Response(null, { status: 400 });

  let { wallet, wallets } = await request.json();

  if (!wallets) wallets = [wallet];
  if (wallets.length === 0 || wallets.some(isInvalidAddress)) {
    return new Response(null, { status: 422 });
  }

  const query = getFtQuery(wallets);
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
