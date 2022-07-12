import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

export interface AllowListEntry {
  freeAllowance: number;
  paidAllowance: number;
}

export type AllowList = {
  [key: string]: AllowListEntry;
};

export function buildTree(allowlist: AllowList): MerkleTree {
  return new MerkleTree(
    Object.entries(allowlist).map((entry) => hashEntry(...entry)),
    keccak256,
    {
      sort: true,
    }
  );
}

export function hashEntry(address: string, entry: AllowListEntry): Buffer {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(
        ["address", "uint256", "uint256"],
        [address, entry.freeAllowance, entry.paidAllowance]
      )
      .slice(2),
    "hex"
  );
}
