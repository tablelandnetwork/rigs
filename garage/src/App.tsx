import React from "react";
import "./polyfills";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  ChakraProvider,
  extendTheme,
  withDefaultProps,
} from "@chakra-ui/react";
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
import { RigDetails } from "./pages/RigDetails";
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
  paper: "#101E1E",
};

const theme = extendTheme(
  {
    colors: {
      ...colors,
      block: colors.bg,
    },
    fonts: {
      heading: "'Andale Mono', sans-serif",
      body: "'Andale Mono', sans-serif",
    },
    config: {
      initialColorMode: "dark",
      useSystemColorMode: false,
    },
    styles: {
      global: {
        html: {
          fontSize: "14px",
        },
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
    components: {
      Modal: {
        baseStyle: { dialog: {  bg: "paper" } },
      },
      Text: {
        variants: {
          orbitron: { fontFamily: "'Orbitron', sans-serif", fontWeight: 900 },
        },
      },
      Heading: {
        baseStyle: { fontWeight: "normal" },
        sizes: { md: { fontSize: "1.5em" } },
        variants: {
          orbitron: { fontFamily: "'Orbitron', sans-serif", fontWeight: 900 },
        },
      },
      Button: {
        baseStyle: {
          textTransform: "uppercase",
        },
        variants: {
          "outlined-background": {
            bg: "bg",
            borderColor: "primary",
            border: "1px solid",
            _hover: { bg: "#264646" },
          },
          "outlined": {
            bg: "paper",
            borderColor: "primary",
            border: "1px solid",
            _hover: { bg: "#203c3c" },
          },
          "solid": {
            bg: "bg",
            color: "primary",
            _hover: { bg: "#264646" },
          },
          "ghost": {
            _hover: { bg: "#203c3c" },
          },
        },
      },
    },
  },
  withDefaultProps({
    defaultProps: { size: "md" },
    components: ["Heading"],
  })
);

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
              <Route
                path="/rigs/:id"
                element={
                  <RequiresWalletConnection>
                    <RigDetails />
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
