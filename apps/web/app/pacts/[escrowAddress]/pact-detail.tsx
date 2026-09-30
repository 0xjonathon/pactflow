"use client";
import { useMemo, useState, type FormEvent } from "react";
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

function same(a?: string, b?: string) { return !!a && !!b && a.toLowerCase() === b.toLowerCase(); }
function obj(value: CanonicalValue | null): Record<string, CanonicalValue> | null { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }

export function PactDetail({ escrowAddress, agreementURI }: { escrowAddress: string; agreementURI?: string }) {
  const { address, chainId } = useAccount();
  const wallet = usePactWalletAdapter();
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<{ message: string; details: string }>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [notes, setNotes] = useState("");
  const flow = useTransactionFlow();
  const protocol = useMemo(() => { try { return { sdk: protocolSdk() }; } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; } }, []);
  const valid = isAddress(escrowAddress);
  const escrow = valid ? escrowAddress as Address : undefined;
  const pactQuery = useQuery({ queryKey: ["pact", escrowAddress], queryFn: () => protocol.sdk!.getPact(escrow!), enabled: !!escrow && !!protocol.sdk, refetchInterval: 4000 });
  const pact = pactQuery.data;
  const tokenQuery = useQuery({ queryKey: ["token", pact?.settlementToken], queryFn: () => protocol.sdk!.getTokenMetadata(pact!.settlementToken), enabled: !!pact && !!protocol.sdk });
  const clientRep = useQuery({ queryKey: ["rep", pact?.client], queryFn: () => protocol.sdk!.getReputation(pact!.client), enabled: pact?.status === "Completed" && !!protocol.sdk });
  const workerRep = useQuery({ queryKey: ["rep", pact?.worker], queryFn: () => protocol.sdk!.getReputation(pact!.worker!), enabled: pact?.status === "Completed" && !!pact.worker && !!protocol.sdk });
  const workerBalance = useQuery({ queryKey: ["balance", pact?.worker, pact?.settlementToken], queryFn: () => protocol.sdk!.getTokenBalance(pact!.settlementToken, pact!.worker!), enabled: pact?.status === "Completed" && !!pact.worker && !!protocol.sdk });
  const agreement = pact && agreementURI ? obj(parseVerifiedDataUri(agreementURI, pact.agreementHash)) : null;
  const first = pact?.milestones[0];
  const deliverable = first?.deliverableURI && first?.deliverableHash ? obj(parseVerifiedDataUri(first.deliverableURI, first.deliverableHash)) : null;
  const format = (amount: bigint) => tokenQuery.data ? `${formatUnits(amount, tokenQuery.data.decimals)} ${tokenQuery.data.symbol}` : `${amount} raw units`;
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
      if (allowance < required) await flow.run("Approve Token", hooks => protocol.sdk!.approveToken(wallet, pact.settlementToken, pact.escrowAddress, required, hooks));
      await flow.run("Fund Pact", hooks => protocol.sdk!.fundPact(wallet, pact.escrowAddress, hooks));
    });
  }
  async function accept() {
    if (!pact || !wallet || !protocol.sdk) return;
    await perform(async () => {
      const required = pact.workerBond;
      const balance = await protocol.sdk!.getTokenBalance(pact.settlementToken, wallet.address);
      if (balance < required) throw new Error(`Insufficient token balance for worker bond. Need ${format(required)}`);
      const allowance = await protocol.sdk!.getAllowance(pact.settlementToken, wallet.address, pact.escrowAddress);
      if (allowance < required) await flow.run("Approve Worker Bond", hooks => protocol.sdk!.approveToken(wallet, pact.settlementToken, pact.escrowAddress, required, hooks));
      await flow.run("Accept Pact", hooks => protocol.sdk!.acceptPact(wallet, pact.escrowAddress, hooks));
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!pact || !wallet || !protocol.sdk) return;
    await perform(async () => {
      if (!previewUrl.trim()) throw new Error("Enter a deliverable URL");
      const metadata: CanonicalValue = { previewUrl: previewUrl.trim(), notes: notes.trim(), submittedBy: wallet.address, timestamp: new Date().toISOString() };
      await flow.run("Submit Milestone", hooks => protocol.sdk!.submitMilestone(wallet, pact.escrowAddress, 0n, hashAgreement(metadata), dataUriForAgreement(metadata), hooks));
    });
  }
  async function approve() {
    if (!pact || !wallet || !protocol.sdk) return;
    await perform(async () => { await flow.run("Approve & Release", hooks => protocol.sdk!.approveMilestone(wallet, pact.escrowAddress, 0n, hooks)); });
  }

  return <main className="shell"><header className="topbar"><Link href="/" className="brand">PactFlow.</Link><WalletBar /></header>
    <div className="eyebrow">Direct Pact · Monad Testnet</div><h1>Pact Detail</h1>
    {!valid && <div className="notice error">Invalid Escrow address.</div>}
    {protocol.error && <div className="notice error">{protocol.error}. Configure the deployed protocol addresses.</div>}
    {pactQuery.isLoading && <div className="card">Reading Pact from Monad Testnet…</div>}
    {pactQuery.error && <div className="notice error">Unable to read Pact: {pactQuery.error instanceof Error ? pactQuery.error.message : String(pactQuery.error)}</div>}
    {pact && <><section className="card"><span className="pill">{pact.status.toUpperCase()}</span><h2>{typeof agreement?.title === "string" ? agreement.title : "Onchain Pact"}</h2>{typeof agreement?.description === "string" && <p>{agreement.description}</p>}
      <div className="row"><span>Pact ID / Escrow</span><a className="mono" href={getExplorerAddressUrl(pact.escrowAddress)} target="_blank" rel="noreferrer">{pact.escrowAddress}</a></div>
      <div className="row"><span>Client</span><strong className="mono">{pact.client}</strong></div><div className="row"><span>Worker</span><strong className="mono">{pact.worker || pact.fixedWorker || "Open"}</strong></div>
      <div className="row"><span>Settlement token</span><strong className="mono">{pact.settlementToken}</strong></div><div className="row"><span>Budget</span><strong>{format(pact.totalBudget)}</strong></div>
      <div className="row"><span>Client bond remaining / required</span><strong>{format(pact.clientBond)}</strong></div><div className="row"><span>Worker bond remaining / required</span><strong>{format(pact.workerBond)}</strong></div>
      <div className="row"><span>Agreement Hash</span><strong className="mono">{pact.agreementHash}</strong></div><div className="row"><span>Acceptance deadline</span><strong>{new Date(Number(pact.acceptanceDeadline) * 1000).toLocaleString()}</strong></div>
      {agreementURI && !agreement && <p className="danger">Agreement metadata in this link failed hash verification.</p>}
      {!agreementURI && <p className="small">Only the agreement hash is stored on chain. Open the creator's full share link to view its verified title and description.</p>}
    </section>
    <section className="card"><h2>Milestones</h2>{pact.milestones.map(m => <div key={m.id.toString()}><div className="row"><span>{typeof obj(agreement?.milestones && Array.isArray(agreement.milestones) ? agreement.milestones[Number(m.id)] : null)?.title === "string" ? String(obj(agreement?.milestones && Array.isArray(agreement.milestones) ? agreement.milestones[Number(m.id)] : null)?.title) : `Milestone ${Number(m.id) + 1}`}</span><strong>{m.status} · {format(m.amount)}</strong></div><div className="row"><span>Mode / due</span><span>{m.mode} · {new Date(Number(m.dueAt) * 1000).toLocaleString()}</span></div>{m.deliverableHash !== "0x" && !/^0x0{64}$/i.test(m.deliverableHash) && <><div className="row"><span>Deliverable hash</span><strong className="mono">{m.deliverableHash}</strong></div>{m.submittedAt && <div className="row"><span>Submitted at</span><span>{new Date(Number(m.submittedAt) * 1000).toLocaleString()}</span></div>}{deliverable && <><div className="row"><span>Deliverable URL</span><span className="mono">{String(deliverable.previewUrl || "")}</span></div><div className="row"><span>Notes</span><span>{String(deliverable.notes || "")}</span></div></>}</>}</div>)}</section>
    <NetworkGuard>{pact.status === "Created" && same(address, pact.client) && <section className="card"><h2>Fund Pact</h2><p className="small">Approve Token, then Fund Pact. Both are real wallet transactions.</p><button disabled={actionBusy} onClick={fund}>Fund Pact · {format(pact.totalBudget + pact.clientBond)}</button></section>}
      {pact.status === "Funded" && (!pact.fixedWorker || same(address, pact.fixedWorker)) && !same(address, pact.client) && <section className="card"><h2>Accept Pact</h2><p className="small">Approve Worker Bond, then Accept Pact.</p><button disabled={actionBusy} onClick={accept}>Accept Pact · bond {format(pact.workerBond)}</button></section>}
      {pact.status === "Active" && same(address, pact.worker) && first?.status === "Pending" && <form className="card" onSubmit={submit}><h2>Submit Milestone</h2><div className="field"><label>Deliverable URL</label><input type="url" value={previewUrl} onChange={e => setPreviewUrl(e.target.value)} required placeholder="https://…" /></div><div className="spacer" /><div className="field"><label>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} /></div><div className="actions"><button disabled={actionBusy} type="submit">Submit Deliverable</button></div></form>}
      {pact.status === "Submitted" && same(address, pact.client) && first?.mode === "ClientOnly" && <section className="card"><h2>Approve & Release</h2><p>Review the deliverable hash and URL above before releasing {format(first.amount)} gross to the worker.</p><button disabled={actionBusy} onClick={approve}>Approve & Release</button></section>}</NetworkGuard>
    {actionError && <div className="notice error">{actionError.message}<details><summary>Details</summary><pre className="mono small">{actionError.details}</pre></details></div>}
    <TransactionTimeline steps={flow.steps} />
    {pact.status === "Completed" && <section className="card"><span className="pill">PAID</span><h2>Onchain reputation updated</h2><div className="row"><span>Released amount (gross)</span><strong>{format(pact.releasedBudget)}</strong></div><div className="row"><span>Worker</span><strong className="mono">{pact.worker}</strong></div><div className="row"><span>Worker current token balance</span><strong>{workerBalance.data !== undefined ? format(workerBalance.data) : "Reading…"}</strong></div><div className="grid"><div><h3>Client stats</h3><p>Completed Pacts: {clientRep.data?.completedPacts?.toString() ?? "Reading…"}</p></div><div><h3>Worker stats</h3><p>Completed Pacts: {workerRep.data?.completedPacts?.toString() ?? "Reading…"}</p><p>Completed Milestones: {workerRep.data?.settledMilestones?.toString() ?? "Reading…"}</p><p>Settled Volume (gross): {workerRep.data ? format(workerRep.data.earned) : "Reading…"}</p></div></div></section>}
    </>}
  </main>;
}
