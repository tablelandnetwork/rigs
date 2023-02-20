import { Database, Validator } from "@tableland/sdk";
import { chain } from "../env";

const db = Database.readOnly(chain.id);
const validator = new Validator(db.config);
const data = { db, validator };

export const useTablelandConnection = () => {
  return data;
};
