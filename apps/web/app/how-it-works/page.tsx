import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HowItWorksPage } from "../../components/WorkJourney";
export async function generateMetadata(): Promise<Metadata> {
  const zh = (await cookies()).get("pactflow_locale")?.value === "zh-CN";
  return {
    title: zh ? "如何开始合作 — PactFlow" : "How it works — PactFlow",
    description: zh
      ? "先发布需求寻找合作方，再确认协议和资金，交付验收后结算并留下真实记录。"
      : "Publish a brief, choose a partner, confirm terms and secure funds, then deliver, review and settle with a verifiable receipt.",
  };
}
export default function Page() {
  return <HowItWorksPage />;
}
