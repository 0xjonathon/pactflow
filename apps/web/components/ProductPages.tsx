"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useI18n,
  type MessageKey,
  formatDate,
  pactStatusLabel,
} from "../lib/i18n";
import {
  api,
  post,
  useData,
  useSession,
  SignInCard,
  ErrorMessage,
  amount,
  rawAmount,
  categoryLabel,
  methodLabel,
  analytics,
  type Job,
  type Person,
  type Proposal,
  type Metrics,
} from "../lib/product";
import { getExplorerTxUrl, getExplorerAddressUrl } from "@pactflow/chain";
const categories = ["Development", "Design", "Research", "Data", "Content"];
function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-title">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
function DataState({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
}) {
  const { t } = useI18n();
  return loading ? (
    <div className="empty-state">{t("marketplace.loading")}</div>
  ) : error ? (
    <div role="alert" className="empty-state">
      {t("marketplace.unavailable")}
    </div>
  ) : empty ? (
    <div className="empty-state">{t("marketplace.empty")}</div>
  ) : null;
}
export function JobCard({ job }: { job: Job }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/jobs/${job.id}`} className="job-card">
      <div className="card-meta">
        <span>{categoryLabel(job.category, t)}</span>
        {job.demo && (
          <span className="demo-label">{t("marketplace.demo")}</span>
        )}
      </div>
      <h3>{job.title}</h3>
      <p>
        {job.description.slice(0, 145)}
        {job.description.length > 145 && "…"}
      </p>
      <div className="skills">
        {job.skills.slice(0, 3).map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="card-budget">
        <strong>
          {amount(job.budget)} <small>USDC</small>
        </strong>
        <span className={job.fundsLocked ? "locked-badge" : "subtle-badge"}>
          {job.fundsLocked
            ? "◈ " + t("marketplace.locked")
            : t("marketplace.notLocked")}
        </span>
      </div>
      <div className="card-meta">
        <span>
          {methodLabel(job.verificationMode, t)} · {job.milestones.length}{" "}
          {t("jobs.milestones")}
        </span>
        <span>{new Date(job.deadline).toLocaleDateString(locale)}</span>
      </div>
      <footer>
        <span className="avatar">{job.client.displayName[0]}</span>
        <div>
          <strong>{job.client.displayName}</strong>
          <span>
            {job.client.reputation?.completedPacts ?? 0}{" "}
            {t("marketplace.completed")}
          </span>
        </div>
      </footer>
    </Link>
  );
}
export function LandingPage() {
  const { t } = useI18n();
  const jobs = useData<{ items: Job[]; total: number }>("home", "/jobs");
  const stats = useData<{
    completedPacts: number;
    settledVolume: string;
    aiVerifications: number;
    indexedAt: string | null;
  }>("stats", "/stats");
  useEffect(() => {
    analytics("landing_view");
  }, []);
  return (
    <main className="shell commerce-home">
      <section className="product-hero">
        <div>
          <div className="eyebrow commerce-eyebrow">
            <span />
            {t("commerce.eyebrow")}
          </div>
          <h1>
            {t("marketplace.hero")
              .split("\n")
              .map((line, i) => (
                <span key={line} className={i ? "hero-second" : ""}>
                  {line}
                </span>
              ))}
          </h1>
          <p>{t("marketplace.subtitle")}</p>
          <div className="actions">
            <Link className="button" href="/jobs/new">
              {t("marketplace.post")} ↗
            </Link>
            <Link className="button secondary" href="/discover">
              {t("marketplace.find")}
            </Link>
          </div>
          <div className="hero-note">
            ◈ {t("marketplace.howTwo")} <span>·</span> ✓{" "}
            {t("marketplace.howThree")}
          </div>
        </div>
        <div className="collaboration-preview">
          <div className="preview-top">
            <span className="preview-mark">P</span>
            <span>{t("commerce.demoTitle")}</span>
            <span className="demo-label">{t("marketplace.demo")}</span>
          </div>
          <div className="preview-body">
            <p className="small">{t("commerce.demoParties")}</p>
            <h3>{t("commerce.demoScope")}</h3>
            <div className="preview-payment">
              <div>
                <span>{t("dashboard.funds")}</span>
                <strong>
                  300 <small>USDC</small>
                </strong>
              </div>
              <span className="locked-badge">◈ {t("marketplace.locked")}</span>
            </div>
            <div className="preview-progress">
              {["One", "Two", "Three", "Four"].map((n, i) => (
                <div key={n}>
                  <span>{i < 3 ? "✓" : "↗"}</span>
                  <small>{t(`commerce.demoStep${n}` as MessageKey)}</small>
                </div>
              ))}
            </div>
            <div className="preview-checks">
              <div>
                <strong>{t("commerce.demoCheck")}</strong>
                <span>{t("jobs.aiReview")}</span>
              </div>
              {[
                t("jobs.reachable"),
                t("jobs.walletElement"),
                "Lighthouse · 91",
                t("jobs.requirements") + " · 94%",
              ].map((x) => (
                <p key={x}>
                  <span>✓</span>
                  {x}
                </p>
              ))}
            </div>
            <div className="preview-settlement">
              <span>✓ {t("verification.verified")}</span>
              <strong>
                300 USDC <small>{t("verification.paid")}</small>
              </strong>
            </div>
          </div>
          <p className="demo-caption">{t("marketplace.explanation")}</p>
        </div>
      </section>
      <section className="browse-surface">
        <div className="section-heading">
          <div>
            <h2>{t("commerce.browse")}</h2>
            <p>{t("commerce.categoryHelp")}</p>
          </div>
        </div>
        <form action="/discover" className="market-search">
          <span aria-hidden="true">⌕</span>
          <input
            name="search"
            aria-label={t("marketplace.search")}
            placeholder={t("marketplace.search")}
          />
          <button>{t("commerce.searchAction")} ↗</button>
        </form>
        <div className="category-grid">
          {categories.map((c, i) => (
            <Link href={`/discover?category=${c}`} key={c}>
              <span className="category-icon" aria-hidden="true">
                {["⌘", "◒", "⌕", "▦", "≡"][i]}
              </span>
              <strong>{categoryLabel(c, t)}</strong>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="stats-strip" aria-label={t("marketplace.stats")}>
        <div>
          <strong>
            {stats.data?.indexedAt ? stats.data.completedPacts : "—"}
          </strong>
          <span>{t("marketplace.completed")}</span>
        </div>
        <div>
          <strong>
            {stats.data?.indexedAt ? rawAmount(stats.data.settledVolume) : "—"}{" "}
            <small>USDC</small>
          </strong>
          <span>{t("marketplace.volume")}</span>
        </div>
        <div>
          <strong>
            {stats.data?.indexedAt ? stats.data.aiVerifications : "—"}
          </strong>
          <span>{t("marketplace.ai")}</span>
        </div>
        <p>
          {t("marketplace.stats")}
          <br />
          <small>
            {stats.data?.indexedAt
              ? new Date(stats.data.indexedAt).toLocaleString()
              : t("common.reading")}
          </small>
        </p>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>{t("marketplace.recommended")}</h2>
          <Link href="/discover">{t("marketplace.discover")} ↗</Link>
        </div>
        <DataState
          loading={jobs.isLoading}
          error={jobs.error}
          empty={!jobs.data?.items.length}
        />
        <div className="job-grid">
          {jobs.data?.items.slice(0, 3).map((j) => (
            <JobCard job={j} key={j.id} />
          ))}
        </div>
      </section>
      <section className="section">
        <h2>{t("marketplace.how")}</h2>
        <div className="steps-grid">
          {["One", "Two", "Three"].map((n, i) => (
            <article key={n}>
              <span className="step-number">0{i + 1}</span>
              <h3>{t(`marketplace.how${n}` as MessageKey)}</h3>
              <p>{t(`marketplace.how${n}Body` as MessageKey)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="protection-section">
        <div>
          <span className="eyebrow">PactFlow</span>
          <h2>{t("commerce.protection")}</h2>
          <p>{t("commerce.protectionBody")}</p>
        </div>
        <div className="protection-cards">
          {[
            ["buyer", "/jobs/new"],
            ["seller", "/discover"],
          ].map(([role, url]) => (
            <Link href={url} key={role}>
              <span className="protection-icon">
                {role === "buyer" ? "↗" : "◇"}
              </span>
              <h3>{t(`commerce.${role}` as MessageKey)}</h3>
              <p>{t(`commerce.${role}Body` as MessageKey)}</p>
              <span>
                {t(role === "buyer" ? "marketplace.post" : "marketplace.find")}{" "}
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="faq-section">
        <h2>{t("commerce.faq")}</h2>
        <div>
          {["One", "Two", "Three"].map((n) => (
            <details key={n}>
              <summary>
                {t(`commerce.question${n}` as MessageKey)}
                <span>+</span>
              </summary>
              <p>{t(`commerce.answer${n}` as MessageKey)}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="closing-panel">
        <h2>{t("commerce.closing")}</h2>
        <p>{t("commerce.closingBody")}</p>
        <Link className="button" href="/jobs/new">
          {t("marketplace.post")} ↗
        </Link>
      </section>
      <footer className="product-footer">
        <Link className="brand" href="/">
          PactFlow ↗
        </Link>
        <span>{t("commerce.footer")}</span>
        <span>{t("marketplace.testnet")}</span>
      </footer>
    </main>
  );
}
export function DiscoverPage() {
  const { t } = useI18n();
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    verification: "",
    minBudget: "",
    maxBudget: "",
    deadline: "",
    funding: "",
    sort: "newest",
    page: "1",
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters((v) => ({
      ...v,
      search: params.get("search") ?? "",
      category: categories.includes(params.get("category") ?? "")
        ? params.get("category")!
        : "",
    }));
  }, []);
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  ).toString();
  const data = useData<{ items: Job[]; total: number; page: number }>(
    "discover",
    `/jobs?${query}`,
  );
  const set = (key: keyof typeof filters, value: string) =>
    setFilters((v) => ({
      ...v,
      [key]: value,
      ...(key !== "page" ? { page: "1" } : {}),
    }));
  return (
    <main className="shell">
      <PageTitle
        eyebrow={t("commerce.brief")}
        title={t("marketplace.discover")}
        subtitle={t("commerce.discoverHelp")}
      />
      <div className="filter-bar">
        <input
          aria-label={t("marketplace.search")}
          placeholder={t("marketplace.search")}
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
        />
        <select
          aria-label={t("marketplace.category")}
          value={filters.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="">
            {t("marketplace.category")} · {t("marketplace.all")}
          </option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c, t)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("marketplace.verification")}
          value={filters.verification}
          onChange={(e) => set("verification", e.target.value)}
        >
          <option value="">
            {t("marketplace.verification")} · {t("marketplace.all")}
          </option>
          {["ClientOnly", "AIOnly", "Hybrid"].map((m) => (
            <option key={m} value={m}>
              {methodLabel(m, t)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("marketplace.sort")}
          value={filters.sort}
          onChange={(e) => set("sort", e.target.value)}
        >
          {[
            ["newest", "newest"],
            ["budget-high", "budgetHigh"],
            ["budget-low", "budgetLow"],
            ["deadline", "soonest"],
          ].map(([v, k]) => (
            <option key={v} value={v}>
              {t(`marketplace.${k}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
      <details className="filter-details">
        <summary>
          {t("marketplace.budget")} · {t("marketplace.deadline")} ·{" "}
          {t("marketplace.funding")}
        </summary>
        <div className="filter-bar">
          <input
            type="number"
            min="0"
            placeholder={t("marketplace.minBudget")}
            aria-label={t("marketplace.minBudget")}
            value={filters.minBudget}
            onChange={(e) => set("minBudget", e.target.value)}
          />
          <input
            type="number"
            min="0"
            placeholder={t("marketplace.maxBudget")}
            aria-label={t("marketplace.maxBudget")}
            value={filters.maxBudget}
            onChange={(e) => set("maxBudget", e.target.value)}
          />
          <label>
            {t("marketplace.byDate")}
            <input
              type="date"
              value={filters.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </label>
          <select
            aria-label={t("marketplace.funding")}
            value={filters.funding}
            onChange={(e) => set("funding", e.target.value)}
          >
            <option value="">{t("marketplace.all")}</option>
            <option value="locked">{t("marketplace.locked")}</option>
            <option value="unfunded">{t("marketplace.notLocked")}</option>
          </select>
        </div>
      </details>
      <div className="results-toolbar">
        <p className="small">
          {t("marketplace.result", { count: data.data?.total ?? 0 })}
        </p>
        {Object.entries(filters).some(
          ([k, v]) => v && k !== "page" && k !== "sort",
        ) && (
          <button
            className="text-button"
            onClick={() => {
              setFilters({
                search: "",
                category: "",
                verification: "",
                minBudget: "",
                maxBudget: "",
                deadline: "",
                funding: "",
                sort: "newest",
                page: "1",
              });
              window.history.replaceState(null, "", "/discover");
            }}
          >
            {t("commerce.clear")} ×
          </button>
        )}
      </div>
      <DataState
        loading={data.isLoading}
        error={data.error}
        empty={!data.data?.items.length}
      />
      <div className="job-grid">
        {data.data?.items.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
      <div className="pagination">
        <button
          className="secondary"
          disabled={Number(filters.page) <= 1}
          onClick={() => set("page", String(Number(filters.page) - 1))}
        >
          {t("marketplace.previous")}
        </button>
        <span>{filters.page}</span>
        <button
          className="secondary"
          disabled={Number(filters.page) * 9 >= (data.data?.total ?? 0)}
          onClick={() => set("page", String(Number(filters.page) + 1))}
        >
          {t("marketplace.next")}
        </button>
      </div>
    </main>
  );
}
export function JobDetailPage({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const data = useData<Job>(id, `/jobs/${id}`);
  const applications = useData<Proposal[]>(
    `proposals-${id}`,
    `/jobs/${id}/proposals`,
    !!user,
  );
  const [message, setMessage] = useState("");
  const [days, setDays] = useState(7);
  const [optional, setOptional] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const job = data.data;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await Promise.all([data.refetch(), applications.refetch()]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (!job)
    return (
      <main className="shell">
        <DataState loading={data.isLoading} error={data.error} empty={false} />
      </main>
    );
  const own = user?.id === job.clientId;
  const mine = applications.data?.find((p) => p.workerId === user?.id);
  return (
    <main className="shell">
      <Link className="back-link" href="/discover">
        ← {t("marketplace.discover")}
      </Link>
      <div className="detail-grid">
        <div>
          <PageTitle
            eyebrow={categoryLabel(job.category, t)}
            title={job.title}
          />
          <div className="skills">
            {job.skills.map((x) => (
              <span key={x}>{x}</span>
            ))}
            {job.demo && <span>{t("marketplace.demo")}</span>}
          </div>
          <section className="card">
            <h3>{t("jobs.description")}</h3>
            <p className="preserve">{job.description}</p>
            <h3>{t("jobs.requirements")}</h3>
            <p className="preserve">{job.requirements}</p>
          </section>
          <section className="card">
            <h3>{t("jobs.milestones")}</h3>
            {job.milestones.map((m, i) => (
              <div className="milestone-row" key={i}>
                <span className="step-number">{i + 1}</span>
                <div>
                  <strong>{m.title}</strong>
                  <p className="small">
                    {formatDate(Date.parse(m.dueAt), locale)}
                  </p>
                </div>
                <strong>{amount(m.amount)} USDC</strong>
              </div>
            ))}
          </section>
          <section className="card">
            <h3>{t("marketplace.verification")}</h3>
            <span className="pill">{methodLabel(job.verificationMode, t)}</span>
            <p>
              {job.verificationMode === "ClientOnly"
                ? t("marketplace.howThreeBody")
                : t("verification.hybridReview")}
            </p>
            <details>
              <summary>{t("jobs.advanced")}</summary>
              <pre>{JSON.stringify(job.policy, null, 2)}</pre>
              {job.escrowAddress && (
                <a
                  href={getExplorerAddressUrl(
                    job.escrowAddress as `0x${string}`,
                  )}
                >
                  {job.escrowAddress}
                </a>
              )}
            </details>
          </section>
          <section className="card">
            <p className="small">{t("jobs.client")}</p>
            <Link href={`/u/${job.client.handle}`}>
              <h3>{job.client.displayName}</h3>
            </Link>
            <p>{job.client.role}</p>
            <MetricGrid metrics={job.client.reputation} />
          </section>
          {own && (
            <section className="card">
              <h2>{t("jobs.proposals")}</h2>
              {!applications.data?.length && (
                <p className="small">{t("jobs.proposalsEmpty")}</p>
              )}
              {applications.data?.map((p) => (
                <article className="proposal-card" key={p.id}>
                  <Link href={`/u/${p.worker.handle}`}>
                    <h3>{p.worker.displayName}</h3>
                  </Link>
                  <div className="skills">
                    {p.worker.skills.map((x) => (
                      <span key={x}>{x}</span>
                    ))}
                  </div>
                  <MetricGrid metrics={p.worker.reputation} />
                  <p className="preserve">{p.message}</p>
                  <p className="small">
                    {p.estimatedDays} {t("jobs.days")} ·{" "}
                    {t(`jobs.${p.status.toLowerCase()}` as MessageKey)}
                  </p>
                  {p.status === "PENDING" && job.status === "OPEN" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(() => post(`/proposals/${p.id}/accept`))
                      }
                    >
                      {t("jobs.select")}
                    </button>
                  )}
                </article>
              ))}
            </section>
          )}
          <ErrorMessage error={error} />
        </div>
        <aside>
          <div className="card sticky">
            <p className="small">{t("marketplace.budget")}</p>
            <div className="large-amount">
              {amount(job.budget)} <small>USDC</small>
            </div>
            <span className={job.fundsLocked ? "locked-badge" : "subtle-badge"}>
              {job.fundsLocked
                ? t("marketplace.locked")
                : t("marketplace.notLocked")}
            </span>
            <div className="row">
              <span>{t("jobs.workerDeposit")}</span>
              <strong>
                {Number(job.workerDeposit) === 0
                  ? t("form.notRequired")
                  : job.workerDeposit + " USDC"}
              </strong>
            </div>
            <div className="row">
              <span>{t("marketplace.verification")}</span>
              <strong>{methodLabel(job.verificationMode, t)}</strong>
            </div>
            <div className="row">
              <span>{t("marketplace.deadline")}</span>
              <strong>
                {new Date(job.deadline).toLocaleDateString(locale)}
              </strong>
            </div>
            {job.escrowAddress ? (
              <Link
                className="button block"
                href={`/pacts/${job.escrowAddress}`}
              >
                {t("jobs.openWorkspace")}
              </Link>
            ) : own && job.status === "MATCHED" ? (
              <Link className="button block" href={`/jobs/${id}/collaborate`}>
                {t("jobs.createCollaboration")}
              </Link>
            ) : !user ? (
              <SignInCard />
            ) : !own && job.status === "OPEN" && !mine ? (
              <button className="block" onClick={() => setApplying(true)}>
                {t("jobs.apply")}
              </button>
            ) : mine ? (
              <>
                <p>{t(`jobs.${mine.status.toLowerCase()}` as MessageKey)}</p>
                {mine.status === "PENDING" && (
                  <button
                    className="secondary"
                    onClick={() =>
                      act(() => post(`/proposals/${mine.id}/withdraw`))
                    }
                  >
                    {t("jobs.withdraw")}
                  </button>
                )}
              </>
            ) : null}
            {own && job.status === "OPEN" && (
              <button
                className="secondary block"
                onClick={() => act(() => post(`/jobs/${id}/close`))}
              >
                {t("jobs.close")}
              </button>
            )}
            {applying && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    await post(`/jobs/${id}/proposals`, {
                      message,
                      estimatedDays: days,
                      acceptBudget: true,
                      ...(optional ? { milestones: JSON.parse(optional) } : {}),
                    });
                    setApplying(false);
                  });
                }}
              >
                <label>
                  {t("jobs.message")}
                  <textarea
                    minLength={20}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <label>
                  {t("jobs.days")}
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </label>
                <label className="check-label">
                  <input type="checkbox" required />
                  {t("jobs.acceptBudget")}
                </label>
                <details>
                  <summary>{t("proposals.optional")}</summary>
                  <textarea
                    value={optional}
                    onChange={(e) => setOptional(e.target.value)}
                  />
                </details>
                <button className="block" disabled={busy}>
                  {t("jobs.submitProposal")}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
export function MetricGrid({
  metrics,
  compact = false,
}: {
  metrics: Metrics | null | undefined;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="metric-grid">
      {[
        ["marketplace.completed", metrics?.completedPacts ?? 0],
        ["marketplace.volume", `${rawAmount(metrics?.settledVolume)} USDC`],
        ["profile.successful", metrics?.successfulMilestones ?? 0],
        [
          "v2.passRate",
          metrics?.passRate == null ? t("v2.empty") : `${metrics.passRate}%`,
        ],
        [
          "v2.revisionRate",
          metrics?.revisionRate == null
            ? t("v2.empty")
            : `${metrics.revisionRate}%`,
        ],
        [
          "profile.onTime",
          metrics?.onTimeRate == null ? "—" : `${metrics.onTimeRate}%`,
        ],
        ["profile.aiVerified", metrics?.aiVerified ?? 0],
        ["profile.humanVerified", metrics?.humanVerified ?? 0],
        [
          "profile.disputeRate",
          metrics?.disputeRate == null ? "—" : `${metrics.disputeRate}%`,
        ],
        ["profile.repeatPeople", metrics?.repeatCounterparties ?? 0],
        ["profile.disputes", metrics?.disputes ?? 0],
        ["profile.disputesLost", metrics?.disputesLost ?? "—"],
        [
          "profile.repeat",
          metrics?.repeatCounterpartyRate == null
            ? "—"
            : `${metrics.repeatCounterpartyRate}%`,
        ],
      ]
        .filter((_, index) => !compact || [0, 1, 3].includes(index))
        .map(([key, value]) => (
          <div key={key}>
            <strong>{value}</strong>
            <span>{t(key as MessageKey)}</span>
          </div>
        ))}
    </div>
  );
}
export function TalentPage() {
  const { t } = useI18n();
  const [q, setQ] = useState({
    search: "",
    category: "",
    skill: "",
    minCompleted: "0",
    page: "1",
  });
  const data = useData<{ items: Person[]; total: number }>(
    "talent",
    `/talent?${new URLSearchParams(q)}`,
  );
  return (
    <main className="shell">
      <PageTitle title={t("talent.headline")} subtitle={t("talent.subtitle")} />
      <div className="filter-bar">
        <input
          placeholder={t("marketplace.search")}
          aria-label={t("marketplace.search")}
          value={q.search}
          onChange={(e) => setQ({ ...q, search: e.target.value, page: "1" })}
        />
        <input
          placeholder={t("talent.skill")}
          aria-label={t("talent.skill")}
          value={q.skill}
          onChange={(e) => setQ({ ...q, skill: e.target.value, page: "1" })}
        />
        <select
          aria-label={t("marketplace.category")}
          value={q.category}
          onChange={(e) => setQ({ ...q, category: e.target.value, page: "1" })}
        >
          <option value="">{t("marketplace.all")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c, t)}
            </option>
          ))}
        </select>
        <label>
          {t("talent.minCompleted")}
          <input
            type="number"
            min="0"
            value={q.minCompleted}
            onChange={(e) =>
              setQ({ ...q, minCompleted: e.target.value, page: "1" })
            }
          />
        </label>
      </div>
      <DataState
        loading={data.isLoading}
        error={data.error}
        empty={!data.data?.items.length}
      />
      <div className="job-grid">
        {data.data?.items.map((p) => (
          <article className="job-card" key={p.id}>
            <div className="person-header">
              <span className="avatar large">{p.displayName[0]}</span>
              <div>
                <h3>{p.displayName}</h3>
                <p>{p.role}</p>
              </div>
              {p.demo && (
                <span className="demo-label">{t("marketplace.demo")}</span>
              )}
            </div>
            <div className="skills">
              {p.skills.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
            <MetricGrid metrics={p.reputation} compact />
            <p className="partner-bio">{p.bio}</p>
            <Link className="button secondary block" href={`/u/${p.handle}`}>
              {t("talent.view")}
            </Link>
          </article>
        ))}
      </div>
      <div className="pagination">
        <button
          disabled={Number(q.page) <= 1}
          onClick={() => setQ({ ...q, page: String(Number(q.page) - 1) })}
        >
          {t("marketplace.previous")}
        </button>
        <span>{q.page}</span>
        <button
          disabled={Number(q.page) * 12 >= (data.data?.total ?? 0)}
          onClick={() => setQ({ ...q, page: String(Number(q.page) + 1) })}
        >
          {t("marketplace.next")}
        </button>
      </div>
    </main>
  );
}
export function ProfilePage({ handle }: { handle: string }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState("overview");
  const data = useData<Person>(handle, `/users/${handle}`);
  const history = useData<{
    pacts: Array<{
      address: string;
      completed: boolean;
      snapshot: {
        totalBudget: string;
        status: Parameters<typeof pactStatusLabel>[0];
      };
    }>;
    events: Array<{
      id: string;
      name: string;
      txHash: string;
      timestamp: string;
    }>;
    receipts: Array<{
      escrow: string;
      publicId: string;
      payload: { title: string };
    }>;
  }>(`history-${handle}`, `/users/${handle}/history`);
  const relations = useData<{
    counterparties: Array<{
      id: string;
      actorA: string;
      actorB: string;
      completedPacts: number;
      settledVolume: string;
    }>;
  }>(`relations-${handle}`, `/users/${handle}/reputation`);
  const p = data.data;
  if (!p)
    return (
      <main className="shell">
        <DataState loading={data.isLoading} error={data.error} empty={false} />
      </main>
    );
  return (
    <main className="shell">
      <p className="eyebrow">{t("v2.passport")}</p>
      <p>{t("v2.passportSubtitle")}</p>
      <div className="profile-hero">
        <span className="avatar giant">{p.displayName[0]}</span>
        <div>
          <h1>{p.displayName}</h1>
          <p>{p.role}</p>
          <span className="small">
            {p.wallet ? t("profile.verified") : t("marketplace.demo")}
          </span>
        </div>
        <Link className="button" href={`/jobs/new?invite=${p.handle}`}>
          {t("profile.invite")}
        </Link>
      </div>
      <MetricGrid metrics={p.reputation} />
      <div className="tabs">
        {["overview", "history", "reputation", "counterparties"].map((k) => (
          <button
            className={tab === k ? "selected" : ""}
            key={k}
            onClick={() => setTab(k)}
          >
            {t(`profile.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <section className="card">
          <h3>{t("profile.overview")}</h3>
          <p className="preserve">{p.bio}</p>
          <div className="skills">
            {p.skills.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          {p.wallet && (
            <details>
              <summary>{t("jobs.advanced")}</summary>
              <a href={getExplorerAddressUrl(p.wallet as `0x${string}`)}>
                {p.wallet}
              </a>
            </details>
          )}
        </section>
      ) : tab === "counterparties" ? (
        <section className="card">
          {!relations.data?.counterparties.length && (
            <p>{t("profile.noHistory")}</p>
          )}
          {relations.data?.counterparties.map((r) => (
            <div className="row" key={r.id}>
              <span className="mono">
                {r.actorA === p.wallet ? r.actorB : r.actorA}
              </span>
              <strong>
                {r.completedPacts} · {rawAmount(r.settledVolume)} USDC
              </strong>
            </div>
          ))}
        </section>
      ) : (
        <section className="card">
          <h3>{t("profile.facts")}</h3>
          {!history.data?.pacts.length && <p>{t("profile.noHistory")}</p>}
          {history.data?.pacts.map((x) => (
            <div className="row" key={x.address}>
              <Link href={`/pacts/${x.address}`}>
                {t("jobs.openWorkspace")}
              </Link>
              <span>
                {pactStatusLabel(x.snapshot?.status, t)} ·{" "}
                {rawAmount(x.snapshot?.totalBudget)} USDC
              </span>
            </div>
          ))}
          {history.data?.receipts?.map((receipt) => (
            <p key={receipt.publicId}>
              <Link href={`/p/${receipt.publicId}`}>
                {t("v2.receipt")} · {receipt.payload.title}
              </Link>
            </p>
          ))}
          {tab === "reputation" &&
            history.data?.events.map((e) => (
              <div className="row" key={e.id}>
                <span>
                  {t(
                    (
                      {
                        Funded: "notifications.pact_funded",
                        Accepted: "notifications.pact_accepted",
                        Submitted: "notifications.work_submitted",
                        MilestoneSettled: "notifications.payment_released",
                        DisputeOpened: "notifications.dispute_opened",
                        Completed: "marketplace.completed",
                        Cancelled: "jobs.cancelled",
                        BondSlashed: "jobs.deposit",
                      } as Record<string, MessageKey>
                    )[e.name] ?? "profile.history",
                  )}
                  <small>
                    {" "}
                    · {formatDate(Date.parse(e.timestamp), locale)}
                  </small>
                </span>
                <a href={getExplorerTxUrl(e.txHash as `0x${string}`)}>
                  {t("common.viewExplorer")}
                </a>
              </div>
            ))}
        </section>
      )}
    </main>
  );
}
export function DashboardPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const [tab, setTab] = useState("client");
  const data = useData<{
    client: Job[];
    worker: Job[];
    pacts: Array<{
      address: string;
      client: string;
      snapshot: { status: string; totalBudget: string };
    }>;
  }>("work", "/me/work", !!user);
  if (!user)
    return (
      <main className="shell">
        <PageTitle title={t("dashboard.title")} />
        <SignInCard />
      </main>
    );
  const values = tab === "client" ? data.data?.client : data.data?.worker;
  return (
    <main className="shell">
      <PageTitle title={t("dashboard.title")} subtitle={user.displayName} />
      <div className="tabs">
        {["client", "worker"].map((k) => (
          <button
            key={k}
            className={tab === k ? "selected" : ""}
            onClick={() => setTab(k)}
          >
            {t(`dashboard.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      <DataState
        loading={data.isLoading}
        error={data.error}
        empty={!values?.length && !data.data?.pacts.length}
      />
      <div className="job-grid">
        {values?.map((j) => (
          <article className="job-card" key={j.id}>
            <span className="pill neutral">
              {j.pactStatus ??
                t(`jobs.${j.status.toLowerCase()}` as MessageKey)}
            </span>
            <h3>{j.title}</h3>
            <strong>{amount(j.budget)} USDC</strong>
            <p className="small">{t("dashboard.next")}</p>
            <Link
              className="button block"
              href={
                j.escrowAddress ? `/pacts/${j.escrowAddress}` : `/jobs/${j.id}`
              }
            >
              {j.pactStatus === "Submitted"
                ? t(tab === "client" ? "dashboard.review" : "dashboard.wait")
                : j.pactStatus === "Active"
                  ? t(tab === "worker" ? "dashboard.submit" : "dashboard.wait")
                  : j.status === "MATCHED" && !j.escrowAddress
                    ? t("jobs.reviewDraft")
                    : j.pactStatus === "Created"
                      ? t(
                          tab === "client"
                            ? "dashboard.fund"
                            : "dashboard.wait",
                        )
                      : j.pactStatus === "Funded"
                        ? t(
                            tab === "worker"
                              ? "dashboard.accept"
                              : "dashboard.wait",
                          )
                        : t("jobs.openWorkspace")}
            </Link>
          </article>
        ))}
      </div>
      {data.data?.pacts
        .filter(
          (p) =>
            (tab === "client"
              ? p.client === user.wallet
              : p.client !== user.wallet) &&
            !values?.some((j) => j.escrowAddress === p.address),
        )
        .map((p) => (
          <div className="card row" key={p.address}>
            <span>
              {p.snapshot?.status} · {rawAmount(p.snapshot?.totalBudget)} USDC
            </span>
            <Link className="button secondary" href={`/pacts/${p.address}`}>
              {t("jobs.openWorkspace")}
            </Link>
          </div>
        ))}
    </main>
  );
}
export function NotificationsPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const data = useData<
    Array<{
      id: string;
      type: string;
      href: string;
      title: string;
      read: boolean;
      createdAt: string;
    }>
  >("notifications", "/notifications", !!user);
  return (
    <main className="shell">
      <PageTitle title={t("notifications.title")} />
      {!user ? (
        <SignInCard />
      ) : (
        <>
          <DataState
            loading={data.isLoading}
            error={data.error}
            empty={false}
          />
          {!data.data?.length && (
            <div className="empty-state">{t("notifications.empty")}</div>
          )}
          {data.data?.map((n) => (
            <article
              className={`notification card ${n.read ? "read" : ""}`}
              key={n.id}
            >
              <div>
                <strong>{t(`notifications.${n.type}` as MessageKey)}</strong>
                <p>{n.title}</p>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
              </div>
              <Link href={n.href}>{t("common.details")} ↗</Link>
              {!n.read && (
                <button
                  className="secondary"
                  onClick={async () => {
                    await api(`/notifications/${n.id}`, { method: "PATCH" });
                    await data.refetch();
                  }}
                >
                  {t("notifications.markRead")}
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </main>
  );
}
export function OnboardingPage() {
  const { t } = useI18n();
  const session = useSession();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>();
  const [form, setForm] = useState({
    displayName: "",
    handle: "",
    role: "",
    bio: "",
    skills: "",
    category: "Development",
    intent: "BOTH",
  });
  useEffect(() => {
    analytics("onboarding_started");
  }, []);
  useEffect(() => {
    if (session.user && step === 1)
      setForm({
        displayName: session.user.displayName,
        handle: session.user.handle,
        role: session.user.role,
        bio: session.user.bio,
        skills: session.user.skills.join(", "),
        category: session.user.category,
        intent: session.user.intent,
      });
  }, [session.user]);
  return (
    <main className="shell narrow">
      <PageTitle title={t("onboarding.title")} />
      <div className="wizard-steps">
        {[1, 2, 3].map((n) => (
          <span key={n} className={step >= n ? "active" : ""}>
            {n}
          </span>
        ))}
      </div>
      {done ? (
        <section className="card">
          <h2>{t("onboarding.complete")}</h2>
          <Link className="button" href="/app">
            {t("marketplace.work")}
          </Link>
        </section>
      ) : (
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            if (step < 3) {
              setStep(step + 1);
              return;
            }
            try {
              await api("/me/profile", {
                method: "PATCH",
                body: JSON.stringify({
                  ...form,
                  skills: form.skills
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }),
              });
              await session.refresh();
              setDone(true);
            } catch (e) {
              setError(e);
            }
          }}
        >
          {step === 1 ? (
            <>
              <h2>{t("onboarding.purpose")}</h2>
              <div className="choice-grid">
                {[
                  ["HIRE", "hire"],
                  ["WORK", "work"],
                  ["BOTH", "both"],
                ].map(([v, k]) => (
                  <button
                    type="button"
                    key={v}
                    className={form.intent === v ? "choice selected" : "choice"}
                    onClick={() => setForm({ ...form, intent: v })}
                  >
                    {t(`onboarding.${k}` as MessageKey)}
                  </button>
                ))}
              </div>
            </>
          ) : step === 2 ? (
            <>
              <h2>{t("onboarding.profile")}</h2>
              {[
                ["displayName", "name"],
                ["handle", "handle"],
                ["role", "role"],
                ["skills", "skills"],
                ["bio", "bio"],
              ].map(([k, label]) => (
                <label key={k}>
                  {t(
                    k === "skills"
                      ? "jobs.skills"
                      : (`profile.${label}` as MessageKey),
                  )}
                  {k === "bio" ? (
                    <textarea
                      value={form.bio}
                      onChange={(e) =>
                        setForm({ ...form, bio: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      required={k !== "skills"}
                      value={form[k as keyof typeof form]}
                      pattern={
                        k === "handle" ? "[a-z0-9][a-z0-9-]{2,30}" : undefined
                      }
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
              <label>
                {t("marketplace.category")}
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c, t)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <h2>{t("onboarding.settlement")}</h2>
              <p>{t("onboarding.why")}</p>
              {!session.user && <SignInCard />}
            </>
          )}
          <ErrorMessage error={error} />
          <div className="actions">
            {step > 1 && (
              <button
                className="secondary"
                type="button"
                onClick={() => setStep(step - 1)}
              >
                {t("onboarding.back")}
              </button>
            )}
            <button disabled={step === 3 && !session.user}>
              {t(step === 3 ? "onboarding.complete" : "onboarding.continue")}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
export { JobWizardPage } from "./JobWizard";

export function ReputationPage() {
  const { t } = useI18n();
  const people = useData<{ items: Person[]; total: number }>(
    "reputation-people",
    "/talent?minCompleted=1",
  );
  return (
    <main className="shell">
      <PageTitle
        title={t("marketplace.reputation")}
        subtitle={t("profile.facts")}
      />
      <DataState
        loading={people.isLoading}
        error={people.error}
        empty={!people.data?.items.length}
      />
      {people.data?.items.map((p) => (
        <section className="card" key={p.id}>
          <Link href={`/u/${p.handle}`}>
            <h2>{p.displayName}</h2>
          </Link>
          <MetricGrid metrics={p.reputation} />
          <Link className="button secondary" href={`/u/${p.handle}`}>
            {t("profile.history")} ↗
          </Link>
        </section>
      ))}
    </main>
  );
}
