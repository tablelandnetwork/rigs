import { connect, Connection } from "@tableland/sdk";
import { useState, useEffect } from "react";

export const useTablelandConnection = () => {
  const [connection, setConnection] = useState<Connection>(connect({ network: "testnet" }));

  return { connection };
};
