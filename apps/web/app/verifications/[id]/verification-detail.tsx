"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getExplorerAddressUrl, getExplorerTxUrl } from "@pactflow/chain";
import type { Address, Hex } from "viem";
import { WalletBar } from "../../../components/WalletBar";
import { useI18n } from "../../../lib/i18n";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
type Rule = { ruleId: string; ruleType: string; passed: boolean; score: number; summary: string; evidence: Record<string, unknown> };
type Report = { canonicalReport: { result: { passed: boolean; score: number; confidence: string }; checks: Rule[]; policy: { rulesHash: Hex }; submission: { deliverableHash: Hex }; pact: { escrow: Address } }; reportHash: Hex; eip712Digest?: Hex; signature?: Hex; attestationTxHash?: Hex };
type Job = { id: string; status: string; score?: number; errorCode?: string; escrowAddress: Address };
async function getJson<T>(path: string): Promise<T> { const response = await fetch(`${api}${path}`); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<T>; }
export function VerificationDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const job = useQuery({ queryKey: ["verification-job", id], queryFn: () => getJson<Job>(`/api/v1/verification/jobs/${id}`), refetchInterval: 2500 });
  const report = useQuery({ queryKey: ["verification-report", id], queryFn: () => getJson<Report>(`/api/v1/verification/jobs/${id}/report`), enabled: job.data?.status === "PASSED" || job.data?.status === "FAILED", refetchInterval: 2500 });
  const value = report.data;
  return <main className="shell">
    <div className="eyebrow">{t("verification.reportViewer")}</div><h1>{t("verification.reportViewer")}</h1>
    {job.isLoading && <section className="card">{t("common.reading")}</section>}
    {job.error && <section className="notice error">{t("verification.apiUnavailable")}</section>}
    {job.data && <section className="card"><span className="pill">{job.data.status === "FAILED" ? t("verification.notVerified") : job.data.status === "PASSED" ? t("verification.verified") : t("verification.progress", { status: job.data.status })}</span>
      <details><summary>{t("jobs.advanced")}</summary><div className="row"><span>{t("verification.jobId")}</span><strong className="mono">{id}</strong></div>
      <div className="row"><span>{t("pact.escrowAddress")}</span><a href={getExplorerAddressUrl(job.data.escrowAddress)} target="_blank" rel="noreferrer">{job.data.escrowAddress}</a></div>
      </details>{job.data.errorCode && <p className="danger">{job.data.errorCode}</p>}
    </section>}
    {value && <><section className="card"><h2>{value.canonicalReport.result.passed ? t("verification.verified") : t("verification.notVerified")}</h2>
      <p>{value.canonicalReport.result.score} / 100 · {value.canonicalReport.result.confidence}</p>
      <details><summary>{t("jobs.advanced")}</summary><div className="row"><span>{t("verification.reportHash")}</span><strong className="mono">{value.reportHash}</strong></div>
      <div className="row"><span>{t("verification.rulesHash")}</span><strong className="mono">{value.canonicalReport.policy.rulesHash}</strong></div>
      <div className="row"><span>{t("milestone.deliverableHash")}</span><strong className="mono">{value.canonicalReport.submission.deliverableHash}</strong></div>
      {value.attestationTxHash && <div className="row"><span>{t("verification.attestationTx")}</span><a href={getExplorerTxUrl(value.attestationTxHash)} target="_blank" rel="noreferrer">{t("common.viewExplorer")}</a></div>}
      {value.eip712Digest && <div className="row"><span>{t("verification.digest")}</span><strong className="mono">{value.eip712Digest}</strong></div>}
      {value.signature && <details><summary>{t("verification.signature")}</summary><pre className="mono small">{value.signature}</pre></details>}
    </details></section><section className="card"><h2>{t("verification.ruleResults")}</h2>{value.canonicalReport.checks.map(rule => <div key={rule.ruleId}><div className="row"><span>{rule.passed ? "✓" : "✕"} {({HTTP_STATUS:t("jobs.reachable"),DOM_SELECTOR:t("jobs.element"),DOM_TEXT:t("jobs.requiredText"),LIGHTHOUSE:t("jobs.performance"),LLM_RUBRIC:t("jobs.semantic"),JSON_SCHEMA:t("verification.jsonData"),API_RESPONSE:t("verification.api"),FILE_HASH:t("verification.evidence")} as Record<string,string>)[rule.ruleType] || t("verification.evidence")}</span><strong>{rule.score}</strong></div><p className="small">{rule.summary}</p><details><summary>{t("verification.evidence")}</summary><pre className="mono small">{JSON.stringify(rule.evidence, null, 2)}</pre></details></div>)}</section></>}
  </main>;
}
