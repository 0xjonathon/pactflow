"use client";
import { useState } from "react";
import type { Hex } from "viem";
import { getExplorerTxUrl } from "@pactflow/chain";
import type { TransactionHooks } from "@pactflow/sdk";

export type TransactionState = "idle" | "awaiting_signature" | "submitted" | "included" | "finalized" | "failed";
type Step = { id: number; label: string; state: TransactionState; hash?: Hex; block?: bigint; message?: string; details?: string };

export function readableError(error: unknown) {
  const details = error instanceof Error ? error.message : String(error);
  const text = details.toLowerCase();
  if (text.includes("user rejected") || text.includes("user denied")) return { message: "Transaction rejected in wallet", details };
  if (text.includes("wrong network") || text.includes("chain mismatch")) return { message: "Wrong Network — switch to Monad Testnet", details };
  if (text.includes("insufficient funds")) return { message: "Insufficient MON for gas", details };
  if (text.includes("allowance")) return { message: "Insufficient token allowance", details };
  if (text.includes("balance")) return { message: "Insufficient token balance", details };
  if (text.includes("invalidstate") || text.includes("expired")) return { message: "Pact action is unavailable or expired; refresh its status", details };
  if (text.includes("unauthorized")) return { message: "This wallet is not authorized for the action", details };
  if (text.includes("already funded") || text.includes("already accepted") || text.includes("already settled")) return { message: "This action has already been completed; refresh the Pact", details };
  if (text.startsWith("enter ") || text.startsWith("set ") || text.startsWith("one milestone") || text.startsWith("client, worker")) return { message: details, details };
  if (text.includes("revert")) return { message: "Transaction reverted on Monad Testnet", details };
  return { message: "Transaction failed. See details for the wallet or RPC error.", details };
}

export function useTransactionFlow() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const update = (id: number, change: Partial<Step>) => setSteps(current => current.map(step => step.id === id ? { ...step, ...change } : step));
  const run = async <T,>(label: string, action: (hooks: TransactionHooks) => Promise<T>): Promise<T> => {
    const id = Date.now() + Math.random();
    setSteps(current => [...current, { id, label, state: "awaiting_signature" }]);
    setBusy(true);
    try {
      const result = await action({
        onHash: hash => update(id, { hash, state: "submitted" }),
        onIncluded: (hash, block) => update(id, { hash, block, state: "included" }),
        onFinalized: (hash, block) => update(id, { hash, block, state: "finalized" }),
      });
      return result;
    } catch (error) {
      update(id, { state: "failed", ...readableError(error) });
      throw error;
    } finally { setBusy(false); }
  };
  return { steps, busy, run };
}

export function TransactionTimeline({ steps }: { steps: ReturnType<typeof useTransactionFlow>["steps"] }) {
  if (!steps.length) return null;
  const labels: Record<TransactionState, string> = { idle: "Idle", awaiting_signature: "Waiting for signature", submitted: "Submitted", included: "Included in Monad block", finalized: "Finalized", failed: "Failed" };
  return <section className="card"><h3>Transactions</h3><ol className="timeline">{steps.map(step => <li key={step.id}><strong>{step.label}</strong><span>{labels[step.state]}{step.block ? ` · block ${step.block}` : ""}</span>{step.hash && <div><a href={getExplorerTxUrl(step.hash)} target="_blank" rel="noreferrer">View on Explorer ↗</a></div>}{step.message && <div className="danger">{step.message}</div>}{step.details && <details><summary>Details</summary><pre className="mono small">{step.details}</pre></details>}</li>)}</ol></section>;
}
