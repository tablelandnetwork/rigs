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
import { configureChains, createConfig, WagmiConfig } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Topbar } from "./Topbar";
import { GlobalFlyParkModals } from "./components/GlobalFlyParkModals";
import { RequiresWalletConnection } from "./components/RequiresWalletConnection";
import { RigAttributeStatsContextProvider } from "./components/RigAttributeStatsContext";
import { NFTsContextProvider } from "./components/NFTsContext";
import { ActingAsAddressContextProvider } from "./components/ActingAsAddressContext";
import { routes } from "./routes";
import { chain } from "./env";

const { chains, publicClient } = configureChains(
  [chain],
  [
    alchemyProvider({ apiKey: import.meta.env.VITE_ALCHEMY_ID }),
    publicProvider(),
  ]
);

const { connectors } = getDefaultWallets({
  appName: "Tableland Garage",
  chains,
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID ?? "",
});

const wagmiClient = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

const colors = {
  primary: "#75B6B5",
  inactive: "#326563",
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
        a: {
          ":not(.chakra-button)": {
            textDecorationLine: "underline",
            textUnderlinePosition: "under",
            textDecorationColor: "inactive",
          },
          ":hover": {
            textDecorationColor: "inherit",
          },
        },
      },
    },
    components: {
      Modal: {
        baseStyle: { dialog: { bg: "paper" } },
      },
      Text: {
        variants: {
          orbitron: { fontFamily: "'Orbitron', sans-serif", fontWeight: 900 },
          emptyState: { fontStyle: "italic" },
        },
      },
      Heading: {
        baseStyle: { fontWeight: "normal" },
        sizes: { md: { fontSize: "1.5em" } },
        variants: {
          orbitron: { fontFamily: "'Orbitron', sans-serif", fontWeight: 900 },
        },
      },
      Tabs: {
        variants: {
          line: {
            tab: {
              color: "primary",
              _selected: { color: "primary" },
            },
          },
        },
      },
      Table: {
        variants: {
          simple: {
            th: {
              color: "primary",
              textTransform: "none",
              fontWeight: "normal",
              fontSize: "0.85714286em",
              px: 2,
            },
            td: {
              px: 2,
            },
            tbody: {
              tr: {
                _last: {
                  td: {
                    borderBottom: "none",
                  },
                },
              },
            },
          },
        },
      },
      Button: {
        baseStyle: {
          textTransform: "uppercase",
        },
        variants: {
          connect: {
            bg: "black",
            color: "white",
            fontWeight: "normal",
          },
          disconnect: {
            bg: "inherit",
            color: "paper",
            border: "none",
            fontWeight: "normal",
            _hover: { textDecoration: "underline" },
          },
          "outlined-background": {
            bg: "bg",
            borderColor: "primary",
            border: "1px solid",
            _hover: { bg: "#264646" },
          },
          outlined: {
            bg: "paper",
            borderColor: "primary",
            border: "1px solid",
            _hover: { bg: "#203c3c" },
          },
          solid: {
            bg: "bg",
            color: "primary",
            _hover: { bg: "#264646" },
          },
          ghost: {
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

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme}>
        <WagmiConfig config={wagmiClient}>
          <RainbowKitProvider chains={chains} theme={darkTheme()}>
            <ActingAsAddressContextProvider>
              <RigAttributeStatsContextProvider>
                <NFTsContextProvider>
                  <BrowserRouter>
                    <Topbar />
                    <GlobalFlyParkModals>
                      <Routes>
                        {routes().map(
                          (
                            { requiresWalletConnection, element, ...props },
                            index
                          ) => (
                            <Route
                              {...props}
                              key={`route-${index}`}
                              element={
                                requiresWalletConnection ? (
                                  <RequiresWalletConnection>
                                    {element}
                                  </RequiresWalletConnection>
                                ) : (
                                  element
                                )
                              }
                            />
                          )
                        )}
                      </Routes>
                    </GlobalFlyParkModals>
                  </BrowserRouter>
                </NFTsContextProvider>
              </RigAttributeStatsContextProvider>
            </ActingAsAddressContextProvider>
          </RainbowKitProvider>
        </WagmiConfig>
      </ChakraProvider>
    </QueryClientProvider>
  );
}

export default App;
