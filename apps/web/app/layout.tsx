import type { ReactNode } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "./providers";
import type { Locale } from "../lib/i18n";
import "./globals.css";

async function storedLocale(): Promise<Locale> {
  return (await cookies()).get("pactflow_locale")?.value === "zh-CN"
    ? "zh-CN"
    : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await storedLocale()) === "zh-CN";
  return {
    title: zh
      ? "PactFlow — 可验证的工作网络"
      : "PactFlow — The Verifiable Work Network",
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3011",
    ),
    openGraph: { siteName: "PactFlow", type: "website" },
    twitter: { card: "summary" },
    description: zh
      ? "为人与 AI Agent 的协作建立可信基础设施。"
      : "Trust infrastructure for work between humans and AI agents.",
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await storedLocale();
  return (
    <html lang={locale}>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
