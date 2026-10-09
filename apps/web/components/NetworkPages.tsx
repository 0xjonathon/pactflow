"use client";
import Link from "next/link";
import { CreationPaths } from "./WorkJourney";
import { BrandLink } from "./BrandLink";
import { useState } from "react";
import { useI18n, type MessageKey } from "../lib/i18n";
import { useData, ErrorMessage, rawAmount } from "../lib/product";
import { getExplorerAddressUrl, getExplorerTxUrl } from "@pactflow/chain";
import type { Address, Hex } from "viem";
export type ActivityEvent = {
  id: string;
  address: Address;
  name: string;
  txHash: Hex;
  timestamp: string;
  args: Record<string, unknown>;
};
export function ActivityList({ items }: { items: ActivityEvent[] }) {
  const { t, locale } = useI18n();
  const labels: Record<string, MessageKey> = {
    PactCreated: "v2.agree",
    Funded: "v2.funds",
    Accepted: "v2.accept",
    Submitted: "v2.submit",
    RevisionRequested: "v2.revision",
    VerificationRecorded: "v2.verification",
    MilestoneSettled: "v2.settle",
    Completed: "v2.complete",
    DisputeOpened: "pact.statusDisputed",
    Cancelled: "pact.statusCancelled",
    MilestoneExpired: "v2.due",
  };
  return (
    <ol className="work-activity">
      {items
        .filter((e) => labels[e.name])
        .map((e) => (
          <li key={e.id}>
            <span className="activity-dot" />
            <div>
              <strong>{t(labels[e.name])}</strong>
              <Link
                className="mono small"
                href={`/pacts/${e.args.pact ?? e.address}`}
              >
                {String(e.args.pact ?? e.address).slice(0, 10)}…
              </Link>
            </div>
            <time className="small">
              {new Date(e.timestamp).toLocaleString(locale)}
            </time>
            <a
              href={getExplorerTxUrl(e.txHash)}
              target="_blank"
              rel="noreferrer"
            >
              {t("v2.viewTransaction")} ↗
            </a>
          </li>
        ))}
    </ol>
  );
}
export function ActivityPage() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const data = useData<{
    items: ActivityEvent[];
    source: string;
    indexedAt: string | null;
  }>("activity", `/activity?page=${page}`);
  return (
    <main className="shell">
      <p className="eyebrow">{t("v2.networkName")}</p>
      <h1>{t("v2.activity")}</h1>
      <p>{t("v2.counts")}</p>
      <ErrorMessage error={data.error} />
      {data.data && (
        <>
          <p className="small">
            {t("v2.source")}:{" "}
            {data.data.source === "ENVIO"
              ? "Envio HyperIndex"
              : t("v2.localRpc")}{" "}
            · {data.data.indexedAt ?? t("v2.unavailable")}
          </p>
          {data.data.items.length ? (
            <ActivityList items={data.data.items} />
          ) : (
            <div className="empty-state">{t("v2.noActivity")}</div>
          )}
          <div className="actions">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              {t("v2.back")}
            </button>
            <button
              disabled={data.data.items.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("v2.next")}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
export function ProofPage() {
  const { t } = useI18n();
  const proof = useData<{
    network: string;
    chainId: number;
    versions: Array<{
      version: number;
      configured?: boolean;
      addresses: Record<string, string | number> | null;
    }>;
    indexer: {
      source: string;
      configured: boolean;
      cursor: { updatedAt: string; blockNumber: number } | null;
    };
    commit: string | null;
    repository: string | null;
  }>("proof", "/proof");
  return (
    <main className="shell narrow">
      <p className="eyebrow">{t("v2.proof")}</p>
      <h1>{t("v2.proofTitle")}</h1>
      <ErrorMessage error={proof.error} />
      {proof.data && (
        <>
          <section className="card">
            <div className="row">
              <span>{t("v2.network")}</span>
              <strong>
                {proof.data.network} · {proof.data.chainId}
              </strong>
            </div>
            <p>{t("v2.monadBody")}</p>
            {proof.data.versions.map((v) => (
              <div key={v.version}>
                <h2>V{v.version}</h2>
                {v.addresses ? (
                  Object.entries(v.addresses)
                    .filter(([key]) =>
                      [
                        "PactFactory",
                        "ReputationRegistry",
                        "VerifierRegistry",
                        "SettlementToken",
                      ].includes(key),
                    )
                    .map(([key, value]) => (
                      <div className="row" key={key}>
                        <span>{key}</span>
                        <a
                          className="mono small"
                          href={getExplorerAddressUrl(value as Address)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {String(value)}
                        </a>
                      </div>
                    ))
                ) : (
                  <p>{t("v2.v2NotConfigured")}</p>
                )}
              </div>
            ))}
          </section>
          <section className="card">
            <h2>{t("v2.source")}</h2>
            <p>
              {proof.data.indexer.configured
                ? "Envio HyperIndex"
                : t("v2.unavailable")}
            </p>
            <p>
              {t("v2.indexed")}:{" "}
              {proof.data.indexer.cursor?.updatedAt ?? t("v2.unavailable")}
            </p>
            <div className="row">
              <span>Commit</span>
              <span className="mono">
                {proof.data.commit ?? t("v2.unavailable")}
              </span>
            </div>
            {proof.data.repository && (
              <a href={proof.data.repository}>GitHub ↗</a>
            )}
          </section>
        </>
      )}
    </main>
  );
}
export function ReceiptPage({ id }: { id: string }) {
  const { t } = useI18n();
  const data = useData<{
    title: string;
    description: string;
    escrow: Address;
    client: string;
    worker: string;
    snapshot: { releasedBudget: string };
    reports: Array<{ id: string; passed: boolean }>;
    transactions: ActivityEvent[];
  }>(`receipt-${id}`, `/receipts/${id}`);
  return (
    <main className="shell narrow">
      <p className="eyebrow">{t("v2.receipt")}</p>
      <ErrorMessage error={data.error} />
      {data.data && (
        <section className="card">
          <span className="pill verified">{t("v2.complete")}</span>
          <h1>{data.data.title}</h1>
          <p>{data.data.description}</p>
          <div className="large-amount">
            {rawAmount(data.data.snapshot.releasedBudget)} USDC
          </div>
          <div className="row">
            <span>{t("v2.client")}</span>
            <strong className="mono small">{data.data.client}</strong>
          </div>
          <div className="row">
            <span>{t("v2.builder")}</span>
            <strong className="mono small">{data.data.worker}</strong>
          </div>
          <Link href={`/pacts/${data.data.escrow}`}>{t("v2.agreement")} ↗</Link>
          {data.data.reports.map((report) => (
            <p key={report.id}>
              <Link href={`/verifications/${report.id}`}>
                {t("v2.verification")} ·{" "}
                {report.passed ? t("verification.verified") : t("v2.revision")}
              </Link>
            </p>
          ))}
          <ActivityList items={data.data.transactions} />
        </section>
      )}
    </main>
  );
}
export function HomePage() {
  const { t } = useI18n();
  const [stage, setStage] = useState(0);
  const loop = [
    "agree",
    "secure",
    "deliver",
    "verify",
    "settle",
    "earn",
  ] as const;
  const stats = useData<{
    pactsCreated: number;
    completedPacts: number;
    settledVolume: string;
    onchainEvents: number;
    indexedAt: string | null;
    source: string;
  }>("stats", "/stats");
  const activity = useData<{ items: ActivityEvent[] }>(
    "home-activity",
    "/activity",
  );
  return (
    <main className="shell v2-home">
      <section className="v2-hero">
        <div>
          <p className="eyebrow">{t("v2.eyebrow")}</p>
          <h1>
            {t("v2.hero1")}
            <br />
            <span>{t("v2.hero2")}</span>
          </h1>
          <p>{t("v2.subtitle")}</p>
          <div className="actions">
            <Link className="button" href="/jobs/new">
              {t("marketplace.post")}
            </Link>
            <Link className="button secondary" href="/discover">
              {t("marketplace.find")}
            </Link>
          </div>
          <p className="small">
            {t("journey.difference")}{" "}
            <Link href="/how-it-works">{t("journey.how")} ↗</Link>
          </p>
          <CreationPaths />
          <p className="small">
            {t("v2.money")} {t("v2.work")} {t("v2.earned")}
          </p>
        </div>
        <div className="pact-preview">
          <p className="eyebrow">{t("v2.example")}</p>
          <h3>{t("v2.sampleTitle")}</h3>
          <strong className="large-amount">
            500 <small>USDC</small>
          </strong>
          <div className="row">
            <span>Alice · {t("v2.client")}</span>
            <span>Marco · {t("v2.builder")}</span>
          </div>
          <ol className="preview-loop">
            {loop.map((key, i) => (
              <li key={key} className={i <= stage ? "done" : ""}>
                {i < stage ? "✓" : i === stage ? "●" : "○"} {t(`v2.${key}`)}
              </li>
            ))}
          </ol>
          <button
            className="secondary"
            onClick={() => setStage((s) => (s + 1) % 6)}
          >
            {t(`v2.${loop[stage]}`)} →
          </button>
        </div>
      </section>
      <section className="v2-section">
        <h2>{t("v2.live")}</h2>
        <div className="live-stats">
          {(["created", "completed", "volume", "events"] as const).map(
            (key, i) => (
              <div key={key}>
                <strong>
                  {stats.data
                    ? [
                        stats.data.pactsCreated,
                        stats.data.completedPacts,
                        `${rawAmount(stats.data.settledVolume)} USDC`,
                        stats.data.onchainEvents,
                      ][i]
                    : t("v2.unavailable")}
                </strong>
                <span>{t(`v2.${key}`)}</span>
              </div>
            ),
          )}
        </div>
        <p className="small">
          {t("v2.source")}:{" "}
          {stats.data?.source === "LOCAL_TEST_ONLY"
            ? t("v2.localChain")
            : (stats.data?.source ?? t("v2.unavailable"))}{" "}
          · {t("v2.indexed")}:{" "}
          {stats.data?.indexedAt
            ? new Date(stats.data.indexedAt).toLocaleString()
            : t("v2.empty")}
        </p>
        <ErrorMessage error={stats.error} />
        {activity.data?.items.length ? (
          <ActivityList items={activity.data.items.slice(0, 8)} />
        ) : (
          <p className="small">{t("v2.noActivity")}</p>
        )}
        <Link href="/activity">{t("v2.activity")} ↗</Link>
      </section>
      <section className="v2-section">
        <h2>{t("v2.loop")}</h2>
        <div className="trust-loop">
          {loop.map((key, i) => (
            <div key={key}>
              <span className="mono small">0{i + 1}</span>
              <h3>{t(`v2.${key}`)}</h3>
              <p>{t(`v2.${key}Desc`)}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="v2-section editorial">
        <div>
          <p className="eyebrow">04 · {t("v2.agreement")}</p>
          <h2>{t("v2.sampleTitle")}</h2>
          <p>{t("v2.termsFrozen")}</p>
        </div>
        <div className="card">
          <p>{t("v2.example")}</p>
          <div className="row">
            <span>{t("v2.funds")}</span>
            <strong>500 USDC</strong>
          </div>
          <div className="row">
            <span>{t("v2.verification")}</span>
            <strong>{t("v2.hybrid")}</strong>
          </div>
          <div className="row">
            <span>{t("v2.revisionLimit")}</span>
            <strong>2</strong>
          </div>
          <p>{t("v2.privacy")}</p>
        </div>
      </section>
      {(
        ["verification", "reputation", "humans", "monad", "developer"] as const
      ).map((key, i) => (
        <section className="v2-section editorial" key={key}>
          <div>
            <p className="eyebrow">0{i + 5}</p>
            <h2>{t(`v2.${key}Title`)}</h2>
          </div>
          <div>
            <p>{t(`v2.${key}Body`)}</p>
            <Link
              href={
                key === "reputation"
                  ? "/reputation"
                  : key === "humans"
                    ? "/network"
                    : "/proof"
              }
            >
              {t(
                key === "reputation"
                  ? "marketplace.reputation"
                  : key === "humans"
                    ? "v2.network"
                    : "v2.proof",
              )}{" "}
              ↗
            </Link>
          </div>
        </section>
      ))}
      <section className="v2-section final-cta">
        <h2>
          {t("v2.hero1")}
          <br />
          {t("v2.hero2")}
        </h2>
        <p>{t("v2.tagline")}</p>
        <Link className="button" href="/jobs/new">
          {t("marketplace.post")}
        </Link>
      </section>
      <footer className="small brand-footer">
        <BrandLink />
        <div>
          <Link href="/how-it-works">{t("journey.how")}</Link> ·{" "}
          <Link href="/pacts/new">{t("journey.direct")}</Link> ·{" "}
          {t("v2.networkName")} ·{" "}
          {process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true"
            ? t("v2.localChain")
            : "Monad Testnet"}
        </div>
      </footer>
    </main>
  );
}
