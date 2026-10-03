"use client";
import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { formatUnits, isAddress, parseUnits, type Address, type Hex } from "viem";
import { getExplorerTxUrl, monadTestnet, monadTestnetUSDC } from "@pactflow/chain";
import { dataUriForAgreement, hashAgreement, type CanonicalValue } from "@pactflow/sdk";
import { WalletBar, NetworkGuard } from "../../../components/WalletBar";
import { TransactionTimeline, useTransactionFlow, readableError } from "../../../features/transaction/useTransactionFlow";
import { protocolSdk } from "../../../lib/protocol";
import { usePactWalletAdapter } from "../../../lib/wallet-adapter";
import { useI18n } from "../../../lib/i18n";
import { hashVerificationPolicy, type VerificationPolicy } from "@pactflow/verifier/policy";
import { buildVerificationPolicy, type VerificationPreset } from "../../../lib/verification";

const day = 86_400;
function defaultDate(days: number) { return new Date(Date.now() + days * day * 1000).toISOString().slice(0, 16); }

export default function NewPactPage() {
  const { t } = useI18n();
  const { address } = useAccount();
  const wallet = usePactWalletAdapter();
  const flow = useTransactionFlow();
  const result = useMemo(() => { try { return { sdk: protocolSdk() }; } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; } }, []);
  const [worker, setWorker] = useState("");
  const [arbitrator, setArbitrator] = useState(process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS || "");
  const [token, setToken] = useState(process.env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS || monadTestnetUSDC.address);
  const [budget, setBudget] = useState("1.00");
  const [clientBond, setClientBond] = useState("0.10");
  const workerBond = "0";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("1.00");
  const [acceptanceDate, setAcceptanceDate] = useState(() => defaultDate(1));
  const [deadline, setDeadline] = useState(() => defaultDate(3));
  const [reviewHours, setReviewHours] = useState("24");
  const [method, setMethod] = useState<"ClientOnly" | "AIOnly" | "Hybrid">("ClientOnly");
  const [preset, setPreset] = useState<VerificationPreset>("WEBSITE");
  const [expectedUrl, setExpectedUrl] = useState("");
  const [requiredText, setRequiredText] = useState("");
  const [requiredSelector, setRequiredSelector] = useState("");
  const [minPerformance, setMinPerformance] = useState("0");
  const [semanticRequirement, setSemanticRequirement] = useState("");
  const [minScore, setMinScore] = useState("80");
  const [advancedJson, setAdvancedJson] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ pactId: Hex; escrowAddress: Address; txHash: Hex; blockNumber: bigint; agreementHash: Hex; link: string; units: bigint; symbol: string; decimals: number }>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!result.sdk || !wallet || !address) return;
    try {
      if (!isAddress(worker) || !isAddress(arbitrator) || !isAddress(token)) throw new Error("INVALID_ADDRESSES");
      if (worker.toLowerCase() === address.toLowerCase() || arbitrator.toLowerCase() === address.toLowerCase() || arbitrator.toLowerCase() === worker.toLowerCase()) throw new Error("DISTINCT_ACTORS");
      const acceptance = BigInt(Math.floor(new Date(acceptanceDate).getTime() / 1000));
      const dueAt = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
      const now = BigInt(Math.floor(Date.now() / 1000));
      const reviewPeriod = BigInt(Math.floor(Number(reviewHours) * 3600));
      if (acceptance <= now || dueAt <= acceptance || reviewPeriod <= 0n || reviewPeriod > BigInt(30 * day)) throw new Error("INVALID_DATES");
      const metadata = await result.sdk.getTokenMetadata(token);
      const units = parseUnits(budget, metadata.decimals);
      const milestoneUnits = parseUnits(milestoneAmount, metadata.decimals);
      const cb = parseUnits(clientBond, metadata.decimals);
      const wb = parseUnits(workerBond, metadata.decimals);
      if (units <= 0n || milestoneUnits !== units || cb < 0n || wb < 0n) throw new Error("INVALID_AMOUNTS");
      const policy: VerificationPolicy | undefined = method === "ClientOnly" ? undefined : buildVerificationPolicy({ preset, mode: method === "AIOnly" ? "AI_ONLY" : "HYBRID", url: expectedUrl.trim(), requiredText,
        selector: requiredSelector, minPerformance: Number(minPerformance), semanticRequirement, minScore: Number(minScore), advancedJson });
      const agreement: CanonicalValue = {
        version: 1, title, description, client: address, worker, arbitrator, settlementToken: token,
        budget: units.toString(), clientBond: cb.toString(), workerBond: wb.toString(),
        acceptanceDeadline: acceptance.toString(), reviewPeriod: reviewPeriod.toString(),
        milestones: [{ title: milestoneTitle, description: milestoneDescription, amount: milestoneUnits.toString(), dueAt: dueAt.toString(), verificationMode: method, ...(policy ? { verificationPolicy: policy as unknown as CanonicalValue } : {}) }],
      };
      const agreementHash = policy ? hashVerificationPolicy(policy) : hashAgreement(agreement);
      const uri = dataUriForAgreement(agreement);
      const outcome = await flow.run("transaction.createPact", hooks => result.sdk!.createPact(wallet, {
        client: address, worker, token, arbitrator, totalBudget: units, clientBond: cb,
        workerBond: wb, acceptanceDeadline: acceptance, reviewPeriod,
        milestones: [{ amount: milestoneUnits, dueAt, rulesHash: agreementHash, mode: method === "ClientOnly" ? 0 : method === "AIOnly" ? 1 : 2 }],
      }, hooks));
      const link = `${window.location.origin}/pacts/${outcome.escrowAddress}?agreement=${encodeURIComponent(uri)}`;
      setCreated({ ...outcome, agreementHash, link, units, symbol: metadata.symbol, decimals: metadata.decimals });
      if (policy) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/verification/policies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escrow: outcome.escrowAddress, milestoneIndex: 0, policy }) });
        if (!response.ok) setError(t("errors.policySaveFailed"));
      }
    } catch (cause) { setError(t(readableError(cause).code)); }
  }

  return <main className="shell">
    <div className="eyebrow">{t("pact.newEyebrow")}</div><h1>{t("pact.createTitle")}</h1><p className="small">{t("pact.createHelp")}</p>
    {result.error ? <div className="notice error">{t("errors.configureProtocol")}<details><summary>{t("common.details")}</summary>{result.error}</details></div> : null}
    {created ? <section className="card"><span className="pill">{t("pact.created")}</span><h2>{title || t("pact.directPact")}</h2><div className="row"><span>{t("pact.id")}</span><strong className="mono">{created.pactId}</strong></div><div className="row"><span>{t("pact.escrowAddress")}</span><strong className="mono">{created.escrowAddress}</strong></div><div className="row"><span>{t("pact.clientWorker")}</span><strong className="mono">{address} / {worker}</strong></div><div className="row"><span>{t("pact.budget")}</span><strong>{formatUnits(created.units, created.decimals)} {created.symbol}</strong></div><div className="row"><span>{method === "ClientOnly" ? t("pact.agreementHash") : t("verification.rulesHash")}</span><strong className="mono">{created.agreementHash}</strong></div><div className="row"><span>{t("pact.monadTransaction")}</span><a href={getExplorerTxUrl(created.txHash)} target="_blank" rel="noreferrer">{t("common.viewExplorer")} · {t("common.block", { number: created.blockNumber })}</a></div><div className="actions"><button onClick={() => navigator.clipboard.writeText(created.link)}>{t("pact.copyLink")}</button><a href={created.link}><button className="secondary">{t("navigation.openPact")}</button></a></div><p className="small">{t("pact.shareHelp")}</p></section> : <NetworkGuard><form className="card" onSubmit={onSubmit}><div className="form-grid">
      <div className="field"><label>{t("pact.workerAddress")}</label><input className="mono" value={worker} onChange={e => setWorker(e.target.value)} required placeholder="0x…" /></div>
      <div className="field"><label>{t("pact.arbitratorAddress")}</label><input className="mono" value={arbitrator} onChange={e => setArbitrator(e.target.value)} required placeholder="0x…" /></div>
      <div className="field"><label>{t("pact.settlementToken")}</label><input className="mono" value={token} onChange={e => setToken(e.target.value)} required /></div>
      <div className="field"><label>{t("pact.budget")}</label><input value={budget} onChange={e => { setBudget(e.target.value); setMilestoneAmount(e.target.value); }} required inputMode="decimal" /></div>
      <div className="field"><label>{t("pact.clientBond")}</label><input value={clientBond} onChange={e => setClientBond(e.target.value)} required inputMode="decimal" /></div>
      <p className="small">{t("form.noWorkerDeposit")}</p>
      <div className="field full"><label>{t("pact.agreementTitle")}</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="field full"><label>{t("pact.agreementDescription")}</label><textarea value={description} onChange={e => setDescription(e.target.value)} required /></div>
      <div className="field"><label>{t("milestone.formTitle")}</label><input value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} required /></div>
      <div className="field"><label>{t("milestone.amount")}</label><input value={milestoneAmount} onChange={e => setMilestoneAmount(e.target.value)} required inputMode="decimal" /></div>
      <div className="field full"><label>{t("milestone.description")}</label><textarea value={milestoneDescription} onChange={e => setMilestoneDescription(e.target.value)} required /></div>
      <div className="field"><label>{t("pact.acceptanceDeadline")}</label><input type="datetime-local" value={acceptanceDate} onChange={e => setAcceptanceDate(e.target.value)} required /></div>
      <div className="field"><label>{t("milestone.deadline")}</label><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required /></div>
      <div className="field"><label>{t("pact.reviewPeriod")}</label><input value={reviewHours} onChange={e => setReviewHours(e.target.value)} required inputMode="numeric" /></div>
      <div className="field full"><label>{t("verification.method")}</label><select value={method} onChange={e => setMethod(e.target.value as typeof method)}><option value="ClientOnly">{t("verification.clientApproval")}</option><option value="AIOnly">{t("verification.aiVerification")}</option><option value="Hybrid">{t("verification.hybrid")}</option></select></div>
      {method !== "ClientOnly" && <><div className="field"><label>{t("verification.preset")}</label><select value={preset} onChange={e => setPreset(e.target.value as VerificationPreset)}><option value="WEBSITE">{t("verification.website")}</option><option value="JSON">{t("verification.jsonData")}</option><option value="API">{t("verification.api")}</option><option value="CUSTOM">{t("verification.custom")}</option></select></div>
        {preset !== "CUSTOM" && <><div className="field full"><label>{t("verification.expectedUrl")}</label><input type="url" value={expectedUrl} onChange={e => setExpectedUrl(e.target.value)} required placeholder="https://…" /></div>
          {preset === "WEBSITE" && <><div className="field"><label>{t("verification.requiredText")}</label><input value={requiredText} onChange={e => setRequiredText(e.target.value)} /></div><div className="field"><label>{t("verification.requiredSelector")}</label><input value={requiredSelector} onChange={e => setRequiredSelector(e.target.value)} placeholder="[data-testid='connect-wallet']" /></div><div className="field"><label>{t("verification.minPerformance")}</label><input type="number" min="0" max="100" value={minPerformance} onChange={e => setMinPerformance(e.target.value)} /></div></>}
          <div className="field full"><label>{t("verification.semanticRequirement")}</label><textarea value={semanticRequirement} onChange={e => setSemanticRequirement(e.target.value)} /></div></>}
        <div className="field"><label>{t("verification.minScore")}</label><input type="number" min="0" max="100" value={minScore} onChange={e => setMinScore(e.target.value)} required /></div>
        <div className="field full"><button type="button" className="secondary" onClick={() => setAdvanced(value => !value)}>{t("verification.advanced")}</button>{advanced && <textarea className="mono" value={preset === "CUSTOM" ? advancedJson : JSON.stringify(buildVerificationPolicy({ preset, mode: method === "AIOnly" ? "AI_ONLY" : "HYBRID", url: expectedUrl, requiredText, selector: requiredSelector, minPerformance: Number(minPerformance), semanticRequirement, minScore: Number(minScore) }), null, 2)} onChange={e => setAdvancedJson(e.target.value)} readOnly={preset !== "CUSTOM"} rows={12} />}</div></>}
    </div><div className="actions"><button type="submit" disabled={flow.busy || !result.sdk}>{t("pact.createButton")}</button></div>{error && <div className="notice error">{error}</div>}</form></NetworkGuard>}
    {created && error && <div className="notice error">{error}</div>}
    <TransactionTimeline steps={flow.steps} />
  </main>;
}
