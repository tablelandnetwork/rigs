import React, { useContext, useMemo, useState } from "react";

interface ManifestoContextValue {
  hasSignedManifesto: boolean;
  setHasSignedManifesto: (hasSigned: boolean) => void;
}

const ManifestoContext = React.createContext<ManifestoContextValue>({
  hasSignedManifesto: false,
  setHasSignedManifesto: () => {},
});

export const ManifestoContextProvider = ({
  children,
}: React.PropsWithChildren) => {
  const [hasSignedManifesto, setHasSignedManifesto] = useState(false);

  const value = useMemo(() => {
    return {
      hasSignedManifesto,
      setHasSignedManifesto: () => setHasSignedManifesto(true),
    };
  }, [hasSignedManifesto, setHasSignedManifesto]);

  return (
    <ManifestoContext.Provider value={value}>
      {children}
    </ManifestoContext.Provider>
  );
};

export const useManifestoContext = () => useContext(ManifestoContext);
