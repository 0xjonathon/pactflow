import type { ReactNode } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "./providers";
import type { Locale } from "../lib/i18n";
import "./globals.css";

async function storedLocale(): Promise<Locale> {
  return (await cookies()).get("pactflow_locale")?.value === "zh-CN" ? "zh-CN" : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const zh = await storedLocale() === "zh-CN";
  return {
    title: zh ? "PactFlow — 清晰约定，安心合作" : "PactFlow — Clear agreements. Protected collaborations.",
    description: zh ? "发布需求，托管资金，验收后结算。" : "Connect with a partner, agree on delivery, secure payment, and settle after review.",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await storedLocale();
  return <html lang={locale}><body><Providers initialLocale={locale}>{children}</Providers></body></html>;
}
