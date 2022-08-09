import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse";
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

export async function getListFromCSVs(filenames: string[]): Promise<AllowList> {
  const list: AllowList = {};

  for (let i = 0; i < filenames.length; i++) {
    const rows = await loadCSV(filenames[i]);
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      if (!list[row.address]) {
        list[row.address] = {
          freeAllowance: row.free_allowance,
          paidAllowance: row.paid_allowance,
        };
      } else {
        list[row.address].freeAllowance += row.free_allowance;
        list[row.address].paidAllowance += row.paid_allowance;
      }
    }
  }

  return list;
}

export function countList(list: AllowList): number {
  let count: number = 0;
  for (const entry of Object.values(list)) {
    count += entry.freeAllowance + entry.paidAllowance;
  }
  return count;
}

type CSVRow = {
  address: string;
  free_allowance: number;
  paid_allowance: number;
};

async function loadCSV(filename: string): Promise<CSVRow[]> {
  const csvFilePath = path.resolve(__dirname, filename);
  const headers = ["address", "free_allowance", "paid_allowance"];
  const fileContent = fs.readFileSync(csvFilePath, { encoding: "utf-8" });

  return new Promise(function (resolve, reject) {
    parse(
      fileContent,
      {
        delimiter: ",",
        columns: headers,
        fromLine: 2,
        cast: (columnValue, context) => {
          if (context.column === "address") {
            return columnValue.toLowerCase();
          } else {
            return parseInt(columnValue);
          }
        },
      },
      (error, result: CSVRow[]) => {
        if (error) {
          reject(error);
        }
        resolve(result);
      }
    );
  });
}

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
        [address.toLowerCase(), entry.freeAllowance, entry.paidAllowance]
      )
      .slice(2),
    "hex"
  );
}
