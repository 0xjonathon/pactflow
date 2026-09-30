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

const day = 86_400;
function defaultDate(days: number) { return new Date(Date.now() + days * day * 1000).toISOString().slice(0, 16); }

export default function NewPactPage() {
  const { address } = useAccount();
  const wallet = usePactWalletAdapter();
  const flow = useTransactionFlow();
  const result = useMemo(() => { try { return { sdk: protocolSdk() }; } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; } }, []);
  const [worker, setWorker] = useState("");
  const [arbitrator, setArbitrator] = useState(process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS || "");
  const [token, setToken] = useState(process.env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS || monadTestnetUSDC.address);
  const [budget, setBudget] = useState("1.00");
  const [clientBond, setClientBond] = useState("0.10");
  const [workerBond, setWorkerBond] = useState("0.10");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("1.00");
  const [acceptanceDate, setAcceptanceDate] = useState(() => defaultDate(1));
  const [deadline, setDeadline] = useState(() => defaultDate(3));
  const [reviewHours, setReviewHours] = useState("24");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ pactId: Hex; escrowAddress: Address; txHash: Hex; blockNumber: bigint; agreementHash: Hex; link: string; units: bigint; symbol: string; decimals: number }>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!result.sdk || !wallet || !address) return;
    try {
      if (!isAddress(worker) || !isAddress(arbitrator) || !isAddress(token)) throw new Error("Enter valid worker, arbitrator and token addresses");
      if (worker.toLowerCase() === address.toLowerCase() || arbitrator.toLowerCase() === address.toLowerCase() || arbitrator.toLowerCase() === worker.toLowerCase()) throw new Error("Client, worker and arbitrator must be different wallets");
      const acceptance = BigInt(Math.floor(new Date(acceptanceDate).getTime() / 1000));
      const dueAt = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
      const now = BigInt(Math.floor(Date.now() / 1000));
      const reviewPeriod = BigInt(Math.floor(Number(reviewHours) * 3600));
      if (acceptance <= now || dueAt <= acceptance || reviewPeriod <= 0n || reviewPeriod > BigInt(30 * day)) throw new Error("Set an acceptance date in the future, a later milestone deadline, and a review period up to 30 days");
      const metadata = await result.sdk.getTokenMetadata(token);
      const units = parseUnits(budget, metadata.decimals);
      const milestoneUnits = parseUnits(milestoneAmount, metadata.decimals);
      const cb = parseUnits(clientBond, metadata.decimals);
      const wb = parseUnits(workerBond, metadata.decimals);
      if (units <= 0n || milestoneUnits !== units || cb < 0n || wb < 0n) throw new Error("One milestone must equal the total budget; amounts cannot be negative");
      const agreement: CanonicalValue = {
        version: 1, title, description, client: address, worker, arbitrator, settlementToken: token,
        budget: units.toString(), clientBond: cb.toString(), workerBond: wb.toString(),
        acceptanceDeadline: acceptance.toString(), reviewPeriod: reviewPeriod.toString(),
        milestones: [{ title: milestoneTitle, description: milestoneDescription, amount: milestoneUnits.toString(), dueAt: dueAt.toString(), verificationMode: "ClientOnly" }],
      };
      const agreementHash = hashAgreement(agreement);
      const uri = dataUriForAgreement(agreement);
      const outcome = await flow.run("Create Pact", hooks => result.sdk!.createPact(wallet, {
        client: address, worker, token, arbitrator, totalBudget: units, clientBond: cb,
        workerBond: wb, acceptanceDeadline: acceptance, reviewPeriod,
        milestones: [{ amount: milestoneUnits, dueAt, rulesHash: agreementHash, mode: 0 }],
      }, hooks));
      const link = `${window.location.origin}/pacts/${outcome.escrowAddress}?agreement=${encodeURIComponent(uri)}`;
      setCreated({ ...outcome, agreementHash, link, units, symbol: metadata.symbol, decimals: metadata.decimals });
    } catch (cause) { setError(readableError(cause).message); }
  }

  return <main className="shell"><header className="topbar"><Link href="/" className="brand">PactFlow.</Link><WalletBar /></header>
    <div className="eyebrow">New direct pact · {monadTestnet.name}</div><h1>Create a Pact</h1><p className="small">One fixed worker, one milestone, ClientOnly approval. The agreement is canonicalized and committed on chain as the milestone rules hash.</p>
    {result.error ? <div className="notice error">{result.error}. Deploy the protocol and configure public addresses to create a Pact.</div> : null}
    {created ? <section className="card"><span className="pill">PACT CREATED</span><h2>{title || "Direct Pact"}</h2><div className="row"><span>Pact ID</span><strong className="mono">{created.pactId}</strong></div><div className="row"><span>Escrow Address</span><strong className="mono">{created.escrowAddress}</strong></div><div className="row"><span>Client / Worker</span><strong className="mono">{address} / {worker}</strong></div><div className="row"><span>Budget</span><strong>{formatUnits(created.units, created.decimals)} {created.symbol}</strong></div><div className="row"><span>Agreement Hash</span><strong className="mono">{created.agreementHash}</strong></div><div className="row"><span>Monad transaction</span><a href={getExplorerTxUrl(created.txHash)} target="_blank" rel="noreferrer">View on Explorer ↗ · block {created.blockNumber}</a></div><div className="actions"><button onClick={() => navigator.clipboard.writeText(created.link)}>Copy Pact Link</button><a href={created.link}><button className="secondary">Open Pact</button></a></div><p className="small">Share the copied link with the worker. It includes agreement metadata and verifies it against the onchain hash.</p></section> : <NetworkGuard><form className="card" onSubmit={onSubmit}><div className="form-grid">
      <div className="field"><label>Worker Address</label><input className="mono" value={worker} onChange={e => setWorker(e.target.value)} required placeholder="0x…" /></div>
      <div className="field"><label>Arbitrator Address</label><input className="mono" value={arbitrator} onChange={e => setArbitrator(e.target.value)} required placeholder="0x…" /></div>
      <div className="field"><label>Settlement Token</label><input className="mono" value={token} onChange={e => setToken(e.target.value)} required /></div>
      <div className="field"><label>Budget</label><input value={budget} onChange={e => { setBudget(e.target.value); setMilestoneAmount(e.target.value); }} required inputMode="decimal" /></div>
      <div className="field"><label>Client Bond</label><input value={clientBond} onChange={e => setClientBond(e.target.value)} required inputMode="decimal" /></div>
      <div className="field"><label>Worker Bond</label><input value={workerBond} onChange={e => setWorkerBond(e.target.value)} required inputMode="decimal" /></div>
      <div className="field full"><label>Agreement Title</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="field full"><label>Agreement Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} required /></div>
      <div className="field"><label>Milestone Title</label><input value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} required /></div>
      <div className="field"><label>Milestone Amount</label><input value={milestoneAmount} onChange={e => setMilestoneAmount(e.target.value)} required inputMode="decimal" /></div>
      <div className="field full"><label>Milestone Description</label><textarea value={milestoneDescription} onChange={e => setMilestoneDescription(e.target.value)} required /></div>
      <div className="field"><label>Acceptance Deadline</label><input type="datetime-local" value={acceptanceDate} onChange={e => setAcceptanceDate(e.target.value)} required /></div>
      <div className="field"><label>Milestone Deadline</label><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required /></div>
      <div className="field"><label>Review Period (hours)</label><input value={reviewHours} onChange={e => setReviewHours(e.target.value)} required inputMode="numeric" /></div>
    </div><div className="actions"><button type="submit" disabled={flow.busy || !result.sdk}>Create Pact on Monad</button></div>{error && <div className="notice error">{error}</div>}</form></NetworkGuard>}
    <TransactionTimeline steps={flow.steps} />
  </main>;
}
