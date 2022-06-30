import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

export function buildTree(allowlist: Map<string, number>): MerkleTree {
  return new MerkleTree(
    Object.entries(allowlist).map((entry) => hashEntry(...entry)),
    keccak256,
    {
      sort: true,
    }
  );
}

function hashEntry(address: string, allowance: number): Buffer {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [address, allowance])
      .slice(2),
    "hex"
  );
}
