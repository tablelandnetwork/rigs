export const prettyNumber = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export const toPercent = (n: number) => Math.round(n * 1000) / 10;

export const truncateWalletAddress = (addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(addr.length - 4)}`;

export const pluralize = (s: string, c: any[]): string => {
  return c.length === 1 ? s : `${s}s`;
};
