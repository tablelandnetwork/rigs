import { Database, Validator, helpers } from "@tableland/sdk";
import { mainChain as chain } from "../env";

const db = new Database({ baseUrl: helpers.getBaseUrl(chain.id) });
const validator = new Validator(db.config);
const data = { db, validator };

export const useTablelandConnection = () => {
  return data;
};
