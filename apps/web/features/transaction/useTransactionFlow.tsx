"use client";
import { useState } from "react";
import type { Hex } from "viem";
import { isRpcRateLimit } from "@pactflow/chain";
import { getExplorerTxUrl } from "@pactflow/chain";
import type { TransactionHooks } from "@pactflow/sdk";
import { useI18n, type MessageKey } from "../../lib/i18n";

export type TransactionState =
  | "idle"
  | "awaiting_signature"
  | "submitted"
  | "included"
  | "finalized"
  | "failed";
type Step = {
  id: number;
  label: MessageKey;
  state: TransactionState;
  hash?: Hex;
  block?: bigint;
  errorCode?: MessageKey;
  details?: string;
};

export function readableError(error: unknown) {
  const details = error instanceof Error ? error.message : String(error);
  const text = details.toLowerCase();
  if (isRpcRateLimit(error))
    return { code: "errors.rpcLimited" as MessageKey, details };
  const exact: Record<string, MessageKey> = {
    INVALID_ADDRESSES: "errors.invalidAddresses",
    DISTINCT_ACTORS: "errors.distinctActors",
    INVALID_DATES: "errors.invalidDates",
    INVALID_AMOUNTS: "errors.invalidAmounts",
    DELIVERABLE_REQUIRED: "errors.deliverableRequired",
  };
  if (exact[details]) return { code: exact[details], details };
  if (text.includes("user rejected") || text.includes("user denied"))
    return { code: "errors.rejected" as MessageKey, details };
  if (text.includes("wrong network") || text.includes("chain mismatch"))
    return { code: "errors.wrongNetwork" as MessageKey, details };
  if (text.includes("insufficient funds"))
    return { code: "errors.insufficientGas" as MessageKey, details };
  if (text.includes("allowance"))
    return { code: "errors.insufficientAllowance" as MessageKey, details };
  if (text.includes("balance"))
    return { code: "errors.insufficientToken" as MessageKey, details };
  if (text.includes("invalidstate") || text.includes("expired"))
    return { code: "errors.unavailable" as MessageKey, details };
  if (text.includes("unauthorized"))
    return { code: "errors.unauthorized" as MessageKey, details };
  if (
    text.includes("already funded") ||
    text.includes("already accepted") ||
    text.includes("already settled")
  )
    return { code: "errors.alreadyComplete" as MessageKey, details };
  if (text.includes("revert"))
    return { code: "errors.reverted" as MessageKey, details };
  return { code: "errors.generic" as MessageKey, details };
}

export function useTransactionFlow() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const update = (id: number, change: Partial<Step>) =>
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, ...change } : step)),
    );
  const run = async <T,>(
    label: MessageKey,
    action: (hooks: TransactionHooks) => Promise<T>,
  ): Promise<T> => {
    const id = Date.now() + Math.random();
    setSteps((current) => [
      ...current,
      { id, label, state: "awaiting_signature" },
    ]);
    setBusy(true);
    try {
      const result = await action({
        onHash: (hash) => update(id, { hash, state: "submitted" }),
        onIncluded: (hash, block) =>
          update(id, { hash, block, state: "included" }),
        onFinalized: (hash, block) =>
          update(id, { hash, block, state: "finalized" }),
      });
      return result;
    } catch (error) {
      update(id, {
        state: "failed",
        errorCode: readableError(error).code,
        details: readableError(error).details,
      });
      throw error;
    } finally {
      setBusy(false);
    }
  };
  return { steps, busy, run };
}

export function TransactionTimeline({
  steps,
}: {
  steps: ReturnType<typeof useTransactionFlow>["steps"];
}) {
  const { t } = useI18n();
  if (!steps.length) return null;
  const labels: Record<TransactionState, MessageKey> = {
    idle: "transaction.idle",
    awaiting_signature: "transaction.awaitingSignature",
    submitted: "transaction.submitted",
    included: "transaction.included",
    finalized: "transaction.finalized",
    failed: "transaction.failed",
  };
  return (
    <section className="card">
      <h3>{t("transaction.title")}</h3>
      <ol className="timeline">
        {steps.map((step) => (
          <li key={step.id}>
            <strong>{t(step.label)}</strong>
            <span>
              {t(labels[step.state])}
              {step.block
                ? ` · ${t("common.block", { number: step.block })}`
                : ""}
            </span>
            {step.hash && (
              <div>
                <a
                  href={getExplorerTxUrl(step.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("common.viewExplorer")}
                </a>
              </div>
            )}
            {step.errorCode && (
              <div className="danger">{t(step.errorCode)}</div>
            )}
            {step.details && (
              <details>
                <summary>{t("common.details")}</summary>
                <pre className="mono small">{step.details}</pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
