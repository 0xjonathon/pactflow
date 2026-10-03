"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { monadTestnet } from "@pactflow/chain";
import { SessionProvider } from "../lib/product";
import { SiteHeader } from "../components/SiteHeader";
import { I18nProvider, type Locale } from "../lib/i18n";

const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: { [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monadTestnet.rpcUrls.default.http[0]) },
  ssr: true,
});

export function Providers({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const [queryClient] = useState(() => new QueryClient());
  return <WagmiProvider config={config}><QueryClientProvider client={queryClient}><I18nProvider initialLocale={initialLocale}><SessionProvider><SiteHeader />{children}</SessionProvider></I18nProvider></QueryClientProvider></WagmiProvider>;
}
