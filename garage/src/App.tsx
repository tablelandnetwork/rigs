import React from "react";
import "./polyfills";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import "@rainbow-me/rainbowkit/styles.css";
import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { chain, configureChains, createClient, WagmiConfig } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";
import { Enter } from "./pages/Enter";
import { Dashboard } from "./pages/Dashboard";
import { RequiresWalletConnection } from "./components/RequiresWalletConnection";

const { chains, provider } = configureChains(
  [chain.mainnet],
  [alchemyProvider({ apiKey: process.env.ALCHEMY_ID }), publicProvider()]
);

const { connectors } = getDefaultWallets({
  appName: "Tableland Garage",
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

const colors = {
  primary: "#75B6B5",
  primaryLight: "#F4706B",
  bg: "#162929",
};

const theme = extendTheme({
  colors: {
    ...colors,
    paper: "#101E1E",
    block: colors.bg,
  },
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: colors.bg,
        color: colors.primary,
      },
      td: { borderColor: "#1E3535 !important" },
      th: {
        borderColor: "#1E3535 !important",
        borderTop: "var(--chakra-borders-1px)",
      },
    },
  },
});

function App() {
  return (
    <ChakraProvider theme={theme}>
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider chains={chains} theme={darkTheme()}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Enter />} />
              <Route
                path="/dashboard"
                element={
                  <RequiresWalletConnection>
                    <Dashboard />
                  </RequiresWalletConnection>
                }
              />
            </Routes>
          </BrowserRouter>
        </RainbowKitProvider>
      </WagmiConfig>
    </ChakraProvider>
  );
}

export default App;
