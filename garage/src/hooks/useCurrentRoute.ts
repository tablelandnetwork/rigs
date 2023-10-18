import { matchRoutes, useLocation } from "react-router-dom";
import { routes } from "~/routes";

export const useCurrentRoute = () => {
  const location = useLocation();
  const match = matchRoutes(routes(), location);

  if (!match) return;

  return match[0];
};
