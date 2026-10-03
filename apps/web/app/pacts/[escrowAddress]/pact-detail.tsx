"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, isAddress, type Address } from "viem";
import { getExplorerAddressUrl, monadTestnet } from "@pactflow/chain";
import { dataUriForAgreement, hashAgreement, parseVerifiedDataUri, type CanonicalValue } from "@pactflow/sdk";
import { WalletBar, NetworkGuard } from "../../../components/WalletBar";
import { TransactionTimeline, useTransactionFlow, readableError } from "../../../features/transaction/useTransactionFlow";
import { protocolSdk } from "../../../lib/protocol";
import { usePactWalletAdapter } from "../../../lib/wallet-adapter";
import { formatDate, milestoneStatusLabel, pactStatusLabel, useI18n, verificationModeLabel, type MessageKey } from "../../../lib/i18n";
import { useData, type Job } from "../../../lib/product";
import { readAgreementUri } from "../../../lib/verification";

function same(a?: string, b?: string) { return !!a && !!b && a.toLowerCase() === b.toLowerCase(); }
function obj(value: CanonicalValue | null): Record<string, CanonicalValue> | null { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
type VerificationJob = { id: string; milestoneIndex: number; status: string; score: number | null; errorCode: string | null; createdAt: string };
const verificationErrorCodes = new Set(["CHAIN_STATE_MISMATCH", "INVALID_POLICY", "RULES_HASH_MISMATCH", "DELIVERABLE_HASH_MISMATCH", "ARTIFACT_UNREACHABLE", "ARTIFACT_TOO_LARGE", "SSRF_BLOCKED", "SEMANTIC_PROVIDER_ERROR", "SEMANTIC_INVALID_OUTPUT", "CHAIN_TX_REVERTED"]);
const verificationStages = ["FETCHING", "DETERMINISTIC", "SEMANTIC", "AGGREGATING", "SIGNING", "SUBMITTING", "PASSED"] as const;
const verificationStageLabels: MessageKey[] = ["verification.progressSecure", "verification.progressStructure", "verification.progressRequirements", "verification.progressProof", "verification.progressSigning", "verification.progressSubmitting", "verification.progressFinalized"];

export function PactDetail({ escrowAddress, agreementURI }: { escrowAddress: string; agreementURI?: string }) {
  const { t, locale } = useI18n();
  const project = useData<Job | null>(`project-${escrowAddress}`, `/pacts/${escrowAddress}/project`);
  const [savedAgreement, setSavedAgreement] = useState<string>();
  useEffect(() => { setSavedAgreement(window.localStorage.getItem(`pactflow_agreement_${escrowAddress.toLowerCase()}`) || undefined); }, [escrowAddress]);
  const metadataURI = agreementURI || savedAgreement;
  const { address, chainId } = useAccount();
  const wallet = usePactWalletAdapter();
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<{ code: MessageKey; details: string }>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const flow = useTransactionFlow();
  const protocol = useMemo(() => { try { return { sdk: protocolSdk() }; } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; } }, []);
  const valid = isAddress(escrowAddress);
  const escrow = valid ? escrowAddress as Address : undefined;
  const pactQuery = useQuery({ queryKey: ["pact", escrowAddress], queryFn: () => protocol.sdk!.getPact(escrow!), enabled: !!escrow && !!protocol.sdk, refetchInterval: 4000 });
  const pact = pactQuery.data;
  const jobsQuery = useQuery({ queryKey: ["verifications", escrowAddress], queryFn: async () => {
    const response = await fetch(`${apiUrl}/api/v1/pacts/${escrowAddress}/verifications`);
    if (!response.ok) throw new Error(`Verification API ${response.status}`);
    return response.json() as Promise<VerificationJob[]>;
  }, enabled: !!escrow && !!pact?.milestones.some(m => m.mode === "AIOnly" || m.mode === "Hybrid"), refetchInterval: 2500 });
  const tokenQuery = useQuery({ queryKey: ["token", pact?.settlementToken], queryFn: () => protocol.sdk!.getTokenMetadata(pact!.settlementToken), enabled: !!pact && !!protocol.sdk });
  const clientRep = useQuery({ queryKey: ["rep", pact?.client], queryFn: () => protocol.sdk!.getReputation(pact!.client), enabled: pact?.status === "Completed" && !!protocol.sdk });
  const workerRep = useQuery({ queryKey: ["rep", pact?.worker], queryFn: () => protocol.sdk!.getReputation(pact!.worker!), enabled: pact?.status === "Completed" && !!pact.worker && !!protocol.sdk });
  const workerBalance = useQuery({ queryKey: ["balance", pact?.worker, pact?.settlementToken], queryFn: () => protocol.sdk!.getTokenBalance(pact!.settlementToken, pact!.worker!), enabled: pact?.status === "Completed" && !!pact.worker && !!protocol.sdk });
  const agreement = pact && metadataURI ? obj(readAgreementUri(metadataURI, pact.agreementHash, pact.milestones[0]?.mode ?? "ClientOnly")) : null;
  const first = pact?.milestones.find(m => m.status !== "Paid") ?? pact?.milestones.at(-1);
  const currentJobs = jobsQuery.data?.filter(j => j.milestoneIndex === Number(first?.id ?? 0n));
  const format = (amount: bigint) => tokenQuery.data ? `${formatUnits(amount, tokenQuery.data.decimals)} ${tokenQuery.data.symbol}` : t("common.reading");
  const refresh = async () => { await Promise.all([pactQuery.refetch(), clientRep.refetch(), workerRep.refetch(), workerBalance.refetch()]); };
  const perform = async (action: () => Promise<void>) => {
    if (actionBusy || !wallet || chainId !== monadTestnet.id || !pact || !protocol.sdk) return;
    setActionBusy(true); setActionError(undefined);
    try { await action(); await refresh(); } catch (error) { setActionError(readableError(error)); }
    finally { setActionBusy(false); }
  };

  async function fund() {
    if (!pact || !wallet || !protocol.sdk) return;
    await perform(async () => {
      const required = pact.totalBudget + pact.clientBond;
      const balance = await protocol.sdk!.getTokenBalance(pact.settlementToken, wallet.address);
      if (balance < required) throw new Error(`Insufficient token balance. Need ${format(required)}`);
      const allowance = await protocol.sdk!.getAllowance(pact.settlementToken, wallet.address, pact.escrowAddress);
      if (allowance < required) await flow.run("transaction.approveToken", hooks => protocol.sdk!.approveToken(wallet, pact.settlementToken, pact.escrowAddress, required, hooks));
      await flow.run("transaction.fundPact", hooks => protocol.sdk!.fundPact(wallet, pact.escrowAddress, hooks));
    });
  }
  async function accept() {
    if (!pact || !wallet || !protocol.sdk) return;
    await perform(async () => {
      const required = pact.workerBond;
      const balance = await protocol.sdk!.getTokenBalance(pact.settlementToken, wallet.address);
      if (balance < required) throw new Error(`Insufficient token balance for worker bond. Need ${format(required)}`);
      const allowance = await protocol.sdk!.getAllowance(pact.settlementToken, wallet.address, pact.escrowAddress);
      if (allowance < required) await flow.run("transaction.approveWorkerBond", hooks => protocol.sdk!.approveToken(wallet, pact.settlementToken, pact.escrowAddress, required, hooks));
      await flow.run("transaction.acceptPact", hooks => protocol.sdk!.acceptPact(wallet, pact.escrowAddress, hooks));
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!pact || !wallet || !protocol.sdk) return;
    await perform(async () => {
      if (!previewUrl.trim()) throw new Error("DELIVERABLE_REQUIRED");
      const metadata: CanonicalValue = { previewUrl: previewUrl.trim(), notes: notes.trim(), submittedBy: wallet.address, timestamp: new Date().toISOString() };
      await flow.run("transaction.submitMilestone", hooks => protocol.sdk!.submitMilestone(wallet, pact.escrowAddress, first?.id ?? 0n, hashAgreement(metadata), dataUriForAgreement(metadata), hooks));
    });
  }
  async function approve() {
    if (!pact || !wallet || !protocol.sdk) return;
    await perform(async () => { await flow.run("transaction.approveRelease", hooks => protocol.sdk!.approveMilestone(wallet, pact.escrowAddress, first?.id ?? 0n, hooks)); });
  }
  async function requestVerification() {
    if (!pact) return;
    setVerificationBusy(true); setVerificationError("");
    try {
      const firstAgreementMilestone = Array.isArray(agreement?.milestones) ? obj(agreement.milestones[Number(first?.id ?? 0n)]) : null;
      if (firstAgreementMilestone?.verificationPolicy) {
        const saved = await fetch(`${apiUrl}/api/v1/verification/policies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escrow: pact.escrowAddress, milestoneIndex: Number(first?.id ?? 0n), policy: firstAgreementMilestone.verificationPolicy }) });
        if (!saved.ok) throw new Error("INVALID_POLICY");
      }
      const response = await fetch(`${apiUrl}/api/v1/verification/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escrow: pact.escrowAddress, milestoneIndex: Number(first?.id ?? 0n) }) });
      if (!response.ok) { const body = await response.json() as { code?: string }; throw new Error(body.code || `HTTP_${response.status}`); }
      await jobsQuery.refetch();
    } catch (error) { const code = error instanceof Error ? error.message : "VERIFICATION_ERROR"; setVerificationError(verificationErrorCodes.has(code) ? t(`errors.${code}` as MessageKey) : t("errors.generic")); }
    finally { setVerificationBusy(false); }
  }

  return <main className="shell">
    <Link className="back-link" href="/app">← {t("marketplace.work")}</Link><h1>{project.data?.title || (typeof agreement?.title === "string" ? agreement.title : t("dashboard.active"))}</h1>
    {!valid && <div className="notice error">{t("errors.invalidEscrow")}</div>}
    {protocol.error && <div className="notice error">{t("errors.configureAddresses")}<details><summary>{t("common.details")}</summary>{protocol.error}</details></div>}
    {pactQuery.isLoading && <div className="card">{t("pact.reading")}</div>}
    {pactQuery.error && <div className="notice error">{t("errors.readPact", { reason: t(readableError(pactQuery.error).code) })}<details><summary>{t("common.details")}</summary>{String(pactQuery.error)}</details></div>}
    {pact && <><section className="card"><span className="pill">{pactStatusLabel(pact.status, t)}</span><p>{project.data?.client.displayName || t("pact.client")} ↔ {project.data?.worker?.displayName || t("pact.worker")}</p>{typeof agreement?.description === "string" && <p>{agreement.description}</p>}
      <div className="stats-strip"><div><strong>{format(pact.totalBudget)}</strong><span>{pact.fundedBudget > 0n && pact.status !== "Completed" ? t("dashboard.safe") : t("marketplace.budget")}</span></div><div><strong>{format(pact.releasedBudget)}</strong><span>{t("dashboard.paid")}</span></div><div><strong>{format(pact.totalBudget-pact.releasedBudget)}</strong><span>{t("dashboard.remaining")}</span></div></div>
      <div className="workspace-timeline">{["Created","Funded","Active","Submitted","Completed"].map((stage,i) => <div key={stage} className={["Created","Funded","Active","Submitted","Completed"].indexOf(pact.status)>=i ? "done" : ""}>{pactStatusLabel(stage as typeof pact.status,t)}</div>)}</div>
      <div className="row"><span>{t("jobs.clientDeposit")}</span><strong>{format(pact.clientBond)}</strong></div><div className="row"><span>{t("jobs.workerDeposit")}</span><strong>{pact.workerBond===0n?t("form.notRequired"):format(pact.workerBond)}</strong></div>
      <details className="onchain-details"><summary>{t("jobs.advanced")}</summary><div className="row"><span>{t("pact.idEscrow")}</span><a className="mono" href={getExplorerAddressUrl(pact.escrowAddress)}>{pact.escrowAddress}</a></div><div className="row"><span>{t("pact.client")}</span><span className="mono">{pact.client}</span></div><div className="row"><span>{t("pact.worker")}</span><span className="mono">{pact.worker||pact.fixedWorker}</span></div><div className="row"><span>{t("pact.settlementToken")}</span><span className="mono">{pact.settlementToken}</span></div><div className="row"><span>{t("pact.agreementHash")}</span><span className="mono">{pact.agreementHash}</span></div><div className="row"><span>{t("pact.acceptanceDeadline")}</span><span>{formatDate(Number(pact.acceptanceDeadline)*1000,locale)}</span></div></details>
    </section>
    <section className="card"><h2>{t("milestone.title")}</h2>{pact.milestones.map(m => { const deliverable = obj(parseVerifiedDataUri(m.deliverableURI, m.deliverableHash)); return <div key={m.id.toString()}><div className="row"><span>{typeof obj(agreement?.milestones && Array.isArray(agreement.milestones) ? agreement.milestones[Number(m.id)] : null)?.title === "string" ? String(obj(agreement?.milestones && Array.isArray(agreement.milestones) ? agreement.milestones[Number(m.id)] : null)?.title) : t("milestone.singleTitle", { number: Number(m.id) + 1 })}</span><strong>{milestoneStatusLabel(m.status, t)} · {format(m.amount)}</strong></div><div className="row"><span>{t("milestone.modeDue")}</span><span>{verificationModeLabel(m.mode, t)} · {formatDate(Number(m.dueAt) * 1000, locale)}</span></div>{m.deliverableHash !== "0x" && !/^0x0{64}$/i.test(m.deliverableHash) && <><details><summary>{t("jobs.advanced")}</summary><div className="row"><span>{t("milestone.deliverableHash")}</span><span className="mono">{m.deliverableHash}</span></div><div className="row"><span>{t("verification.rulesHash")}</span><span className="mono">{m.rulesHash}</span></div></details>{m.submittedAt && <div className="row"><span>{t("milestone.submittedAt")}</span><span>{formatDate(Number(m.submittedAt) * 1000, locale)}</span></div>}{deliverable && <><div className="row"><span>{t("milestone.deliverableUrl")}</span><span className="mono">{String(deliverable.previewUrl || "")}</span></div><div className="row"><span>{t("milestone.notes")}</span><span>{String(deliverable.notes || "")}</span></div></>}</>}</div>; })}</section>
    {(first?.mode === "AIOnly" || first?.mode === "Hybrid") && <section className="card"><h2>{t("verification.title")}</h2>

      {currentJobs?.some(j => j.status === "FAILED") && <p className="small">{t("dashboard.noResubmit")}</p>}
      {first.aiAttested && <span className="pill">{t("verification.verified")}</span>}
      {pact.status === "Submitted" && !first.aiAttested && <button disabled={verificationBusy} onClick={requestVerification}>{t("verification.request")}</button>}
      {verificationError && <p className="danger">{verificationError}</p>}
      {jobsQuery.error && <p className="danger">{t("verification.apiUnavailable")}</p>}
      {(currentJobs ?? []).map(job => <div className="row" key={job.id}><span>{job.status === "FAILED" ? t("verification.notVerified") : job.status === "PASSED" ? t("verification.verified") : t("verification.progress", { status: job.status })}</span><a href={`/verifications/${job.id}`}>{job.score === null ? t("common.details") : `${job.score} / 100`}</a></div>)}
      {currentJobs?.[0] && !["FAILED", "ERROR"].includes(currentJobs[0].status) && <ol className="verification-progress">{verificationStages.map((stage, index) => <li key={stage} className={verificationStages.indexOf(currentJobs![0].status as typeof stage) >= index ? "done" : ""}>{verificationStages.indexOf(currentJobs![0].status as typeof stage) > index ? "✓ " : verificationStages.indexOf(currentJobs![0].status as typeof stage) === index ? "◉ " : "○ "}{t(verificationStageLabels[index])}</li>)}</ol>}
      {first.mode === "Hybrid" && first.aiAttested && pact.status === "Submitted" && <p>{t("verification.hybridReview")}</p>}
    </section>}
    {pact.status !== "Completed" && pact.status !== "Cancelled" && <NetworkGuard>{pact.status === "Created" && same(address, pact.client) && <section className="card"><h2>{t("pact.fundTitle")}</h2><p className="small">{t("pact.fundHelp")}</p><button disabled={actionBusy} onClick={fund}>{t("pact.fundButton", { amount: format(pact.totalBudget + pact.clientBond) })}</button></section>}
      {pact.status === "Funded" && (!pact.fixedWorker || same(address, pact.fixedWorker)) && !same(address, pact.client) && <section className="card"><h2>{t("pact.acceptTitle")}</h2><p className="small">{t(pact.workerBond===0n?"form.acceptWithoutDeposit":"pact.acceptHelp")}</p><button disabled={actionBusy} onClick={accept}>{pact.workerBond===0n?t("form.confirmCollaboration"):t("pact.acceptButton", { amount: format(pact.workerBond) })}</button></section>}
      {pact.status === "Active" && same(address, pact.worker) && first?.status === "Pending" && <form className="card" onSubmit={submit}><h2>{t("milestone.submitTitle")}</h2><div className="field"><label>{t("milestone.deliverableUrl")}</label><input type="url" value={previewUrl} onChange={e => setPreviewUrl(e.target.value)} required placeholder="https://…" /></div><div className="spacer" /><div className="field"><label>{t("milestone.notes")}</label><textarea value={notes} onChange={e => setNotes(e.target.value)} /></div><div className="actions"><button disabled={actionBusy} type="submit">{t("milestone.submitButton")}</button></div></form>}
      {pact.status === "Submitted" && same(address, pact.client) && (first?.mode === "ClientOnly" || first?.mode === "Hybrid" && first.aiAttested) && <section className="card"><h2>{t("pact.approveTitle")}</h2><p>{t("pact.approveHelp", { amount: format(first.amount) })}</p><button disabled={actionBusy} onClick={approve}>{t("pact.approveTitle")}</button></section>}</NetworkGuard>}
    {actionError && <div className="notice error">{t(actionError.code)}<details><summary>{t("common.details")}</summary><pre className="mono small">{actionError.details}</pre></details></div>}
    <TransactionTimeline steps={flow.steps} />
    {pact.status === "Completed" && <section className="card"><span className="pill">{t("verification.paid")}</span><h2>{t("reputation.updated")}</h2><div className="row"><span>{t("reputation.released")}</span><strong>{format(pact.releasedBudget)}</strong></div><div className="row"><span>{t("pact.worker")}</span><strong>{project.data?.worker?.displayName || pact.worker?.slice(0,8)+"…"}</strong></div><div className="row"><span>{t("reputation.workerBalance")}</span><strong>{workerBalance.data !== undefined ? format(workerBalance.data) : t("common.reading")}</strong></div><div className="grid"><div><h3>{t("reputation.clientStats")}</h3><p>{t("reputation.completedPacts")}: {clientRep.data?.completedPacts?.toString() ?? t("common.reading")}</p></div><div><h3>{t("reputation.workerStats")}</h3><p>{t("reputation.completedPacts")}: {workerRep.data?.completedPacts?.toString() ?? t("common.reading")}</p><p>{t("reputation.completedMilestones")}: {workerRep.data?.settledMilestones?.toString() ?? t("common.reading")}</p><p>{t("reputation.settledVolume")}: {workerRep.data ? format(workerRep.data.earned) : t("common.reading")}</p></div></div></section>}
    </>}
  </main>;
}
