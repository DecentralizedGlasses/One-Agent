import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia, baseSepolia, localhost } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import App from "./App";
import "./index.css";

const wagmiConfig = createConfig({
  chains: [sepolia, baseSepolia, localhost],
  transports: {
    [sepolia.id]:     http(),
    [baseSepolia.id]: http(),
    [localhost.id]:   http("http://127.0.0.1:8545"),
  },
});

const queryClient = new QueryClient();
const dynamicEnvironmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID;

if (!dynamicEnvironmentId) {
  console.warn(
    "VITE_DYNAMIC_ENVIRONMENT_ID is not set. Dynamic wallet login will not work until this environment variable is configured."
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DynamicContextProvider
      settings={{
        environmentId: dynamicEnvironmentId ?? "",
        walletConnectors: [EthereumWalletConnectors],
        appName: "One-Agent",
        initialAuthenticationMode: "connect-only",
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <App />
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  </React.StrictMode>
);
