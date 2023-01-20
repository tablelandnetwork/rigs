import { Database, Validator } from "@tableland/sdk";
import { chain } from "../env";

const db = Database.readOnly(chain.id);
// TODO this doesn't work:
// new Validator(db.config)
const validator = new Validator({ baseUrl: "https://tableland.network" });
const data = { db, validator };

export const useTablelandConnection = () => {
  return data;
};
