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
      ? "发布需求、找到合作伙伴，通过资金托管与交付验证建立可信的合作记录。"
      : "Find collaborators, secure milestone payments, verify delivery, and build a verifiable work history.",
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
