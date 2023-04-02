import React, { useContext, useState, useMemo } from "react";

interface ActingAsAddressContextValue {
  actingAsAddress?: string;
  setActingAsAddress: (address: string | undefined) => void;
}

const ActingAsAddressContext = React.createContext<
  ActingAsAddressContextValue | undefined
>(undefined);

export const ActingAsAddressContextProvider = ({
  children,
}: React.PropsWithChildren<{}>) => {
  const [actingAsAddress, setActingAsAddress] = useState<string>();

  const value = useMemo(() => {
    return { actingAsAddress, setActingAsAddress };
  }, [actingAsAddress]);

  return (
    <ActingAsAddressContext.Provider value={value}>
      {children}
    </ActingAsAddressContext.Provider>
  );
};

export const useActingAsAddressContext = () =>
  useContext(ActingAsAddressContext);

export const useActingAsAddress = () => {
  const ctx = useActingAsAddressContext();

  if (!ctx)
    throw new Error("useActingAsAddress cannot be used outside of context");
  const { actingAsAddress, setActingAsAddress } = ctx;

  return { actingAsAddress, setActingAsAddress };
};
