"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { http } from "viem";
import { WagmiProvider } from "wagmi";
import { appChain, appConfig } from "@/lib/config";

const config = getDefaultConfig({
  appName: "FundChain",
  projectId: appConfig.walletConnectProjectId || "development-project-id",
  chains: [appChain],
  transports: { [appChain.id]: http(process.env.NEXT_PUBLIC_RPC_URL) },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 12_000, retry: 2 } },
      }),
  );
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#bef264",
            accentColorForeground: "#020617",
            borderRadius: "large",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
