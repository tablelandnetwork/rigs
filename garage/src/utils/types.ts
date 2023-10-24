import { WalletAddress } from "~/types";

export const isPresent = <T,>(t: T | undefined | null): t is T =>
  t !== undefined && t !== null;

export const isValidAddress = (address?: string): address is WalletAddress => {
  return /0x[0-9a-z]{40,40}/i.test(address || "");
};

export const as0xString = (s?: string): WalletAddress | undefined => {
  if (isValidAddress(s)) return s;
};
