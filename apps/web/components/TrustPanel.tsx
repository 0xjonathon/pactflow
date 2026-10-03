"use client";
import { useI18n } from "../lib/i18n";
import { formatUnits, type Address } from "viem";
import { getExplorerAddressUrl, getExplorerTxUrl } from "@pactflow/chain";
import { useData, type Metrics } from "../lib/product";
import type { ActivityEvent } from "./NetworkPages";
export function TrustPanel({
  pact,
}: {
  pact: {
    escrowAddress: Address;
    totalBudget: string;
    fundedBudget: string;
    releasedBudget: string;
    settledBudget?: string;
    agreementHash: string;
    protocolVersion: number;
    status: string;
    client: string;
    worker?: string;
    fixedWorker?: string;
    milestones?: Array<{ mode: string; verifier?: string }>;
  };
}) {
  const { t } = useI18n();
  const worker = pact.worker ?? pact.fixedWorker;
  const clientReputation = useData<{ metrics: Metrics | null }>(
    `trust-client-${pact.client}`,
    `/wallets/${pact.client}/reputation`,
  );
  const workerReputation = useData<{ metrics: Metrics | null }>(
    `trust-worker-${worker}`,
    `/wallets/${worker}/reputation`,
    !!worker,
  );
  const activity = useData<{ items: ActivityEvent[] }>(
    `trust-transaction-${pact.escrowAddress}`,
    `/activity?escrow=${pact.escrowAddress}`,
  );
  const latest = activity.data?.items[0];
  return (
    <section className="card trust-panel">
      <details open>
        <summary>
          <strong>{t("v2.trust")}</strong>
        </summary>
        <div className="row">
          <span>{t("v2.funds")}</span>
          <strong>
            {formatUnits(
              ["Completed", "Cancelled"].includes(pact.status)
                ? 0n
                : BigInt(pact.fundedBudget) -
                    BigInt(pact.settledBudget ?? pact.releasedBudget),
              6,
            )}{" "}
            USDC
          </strong>
        </div>
        <div className="row">
          <span>{t("v2.agreement")}</span>
          <span>{t("v2.contract")} ✓</span>
        </div>
        <div className="row">
          <span>{t("v2.verifier")}</span>
          <span>
            {pact.milestones?.[0]?.mode === "ClientOnly"
              ? t("v2.manual")
              : t("v2.automated")}
          </span>
        </div>
        {[
          { label: t("v2.client"), data: clientReputation.data?.metrics },
          { label: t("v2.builder"), data: workerReputation.data?.metrics },
        ].map(({ label, data }) => (
          <div className="row" key={label}>
            <span>
              {label} · {t("marketplace.completed")}
            </span>
            <strong>{data?.completedPacts ?? t("v2.empty")}</strong>
          </div>
        ))}
        {latest && (
          <p className="small">
            <a href={getExplorerTxUrl(latest.txHash as `0x${string}`)}>
              {t("common.viewExplorer")}
            </a>
          </p>
        )}
        <div className="row">
          <span>{t("v2.version")}</span>
          <span>V{pact.protocolVersion}</span>
        </div>
        <div className="row">
          <span>{t("v2.network")}</span>
          <span>
            {process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true"
              ? t("v2.localChain")
              : "Monad Testnet"}
          </span>
        </div>
        <a
          href={getExplorerAddressUrl(pact.escrowAddress)}
          target="_blank"
          rel="noreferrer"
          className="mono small"
        >
          {pact.escrowAddress}
        </a>
        <p className="small">{t("v2.counts")}</p>
      </details>
    </section>
  );
}
