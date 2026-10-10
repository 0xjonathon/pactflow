"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits, type Address, type Hex } from "viem";
import { hashAgreement } from "@pactflow/sdk";
import { useI18n, pactStatusLabel, evidenceTypeLabel } from "../lib/i18n";
import {
  api,
  post,
  useData,
  useSession,
  ErrorMessage,
  ApiError,
  SignInCard,
  API,
} from "../lib/product";
import {
  currentRoomView,
  progressFingerprint,
  pactRoomTabs as tabs,
  type RoomView,
  type PactRoomTab,
} from "../lib/pact-room-navigation";
import { protocolSdk } from "../lib/protocol";
import { usePactWalletAdapter } from "../lib/wallet-adapter";
import {
  useTransactionFlow,
  TransactionTimeline,
  readableError,
} from "../features/transaction/useTransactionFlow";
import { PactReviewPanel } from "./PactReviewPanel";
import { PactReceipt } from "./PactReceipt";
import { TrustPanel } from "./TrustPanel";
import { ActivityList, type ActivityEvent } from "./NetworkPages";
type Milestone = {
  id: string;
  amount: string;
  dueAt: string;
  rulesHash: Hex;
  mode: string;
  status: string;
  submissionId?: string;
  maxRevisions?: number;
  aiAttested: boolean;
  clientApproved: boolean;
  reviewDeadline?: string;
};
type State = {
  escrowAddress: Address;
  protocolVersion: 2;
  status:
    | "Created"
    | "Funded"
    | "Active"
    | "Submitted"
    | "RevisionRequired"
    | "Completed"
    | "Cancelled"
    | "Disputed";
  client: Address;
  worker?: Address;
  fixedWorker?: Address;
  arbitrator: Address;
  settlementToken: Address;
  totalBudget: string;
  fundedBudget: string;
  releasedBudget: string;
  settledBudget?: string;
  acceptanceDeadline: string;
  clientBond: string;
  workerBond: string;
  agreementHash: Hex;
  milestones: Milestone[];
};
type Submission = {
  id: string;
  sequence: number;
  milestoneIndex: number;
  status: string;
  createdAt: string;
  manifestHash: Hex;
  reference: string;
  manifest: {
    evidence: Array<{
      id: string;
      label: string;
      type: string;
      source: string;
      visibility: string;
    }>;
  };
};
type Job = {
  id: string;
  status: string;
  milestoneIndex: number;
  submissionSequence: number;
  score: number | null;
  errorCode: string | null;
};
type Spec = {
  spec: {
    title: string;
    outcome: string;
    maxRevisions: number;
    milestones: Array<{
      title: string;
      acceptanceCriteria: string[];
      amount: string;
      dueAt: string;
    }>;
  };
};
export function PactRoom({ escrow }: { escrow: Address }) {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const capabilities = useData<{ uploads: { available: boolean } }>(
    "verification-capabilities",
    "/verification/capabilities",
  );
  const { address } = useAccount();
  const wallet = usePactWalletAdapter();
  const sdk = useMemo(() => protocolSdk(), []);
  const flow = useTransactionFlow();
  const state = useData<{ snapshot: State; indexedAt: string }>(
    `state-${escrow}`,
    `/pacts/${escrow}/state`,
  );
  const pact = state.data?.snapshot;
  const spec = useData<Spec>(`spec-${escrow}`, `/pacts/${escrow}/spec`, !!user);
  const submissions = useData<Submission[]>(
    `submissions-${escrow}`,
    `/pacts/${escrow}/submissions`,
    !!user,
  );
  const jobs = useData<Job[]>(
    `jobs-${escrow}`,
    `/pacts/${escrow}/verifications`,
    !!user,
  );
  const activity = useData<{ items: ActivityEvent[] }>(
    `events-${escrow}`,
    `/activity?escrow=${escrow}`,
  );
  const [room, setRoom] = useState<RoomView & { key: string }>();
  const [items, setItems] = useState([
      { type: "JSON", source: "", label: "Evidence", metadata: { commit: "" } },
    ]),
    [reason, setReason] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [syncPending, setSyncPending] = useState(false);
  const audit = useData<
    Array<{
      id: string;
      type: string;
      payload: {
        reason?: string;
        reportHash?: string;
        report?: { milestone: number; submission: number; approved: boolean };
        txHash?: string;
      };
    }>
  >(`audit-${escrow}`, `/pacts/${escrow}/audit`, !!user);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    path: string;
    body: Record<string, unknown>;
  }>();
  const confirmationKey = `pactflow_confirmation_${escrow.toLowerCase()}_${address?.toLowerCase()}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(confirmationKey);
      setPendingConfirmation(saved ? JSON.parse(saved) : undefined);
    } catch {
      setPendingConfirmation(undefined);
    }
  }, [confirmationKey]);
  const confirmOperation = async (
    path: string,
    body: Record<string, unknown>,
  ) => {
    const pending = { path, body };
    localStorage.setItem(confirmationKey, JSON.stringify(pending));
    setPendingConfirmation(pending);
    await post(path, body);
    localStorage.removeItem(confirmationKey);
    setPendingConfirmation(undefined);
  };
  const [award, setAward] = useState("0");
  useEffect(() => {
    if (state.data?.indexedAt) setSyncPending(false);
  }, [state.data?.indexedAt]);
  const client = pact?.client.toLowerCase() === address?.toLowerCase();
  const builder = pact?.worker?.toLowerCase() === address?.toLowerCase();
  const navigationKey = `pactflow_room_${escrow.toLowerCase()}_${address?.toLowerCase() ?? "visitor"}`;
  const fingerprint = pact ? progressFingerprint(pact) : "";
  const defaultView = pact
    ? currentRoomView(pact, address)
    : { tab: "overview" as const, selected: 0, fingerprint: "" };
  const view =
    room?.key === navigationKey && room.fingerprint === fingerprint
      ? room
      : defaultView;
  const { tab, selected } = view;
  useEffect(() => {
    if (!pact) return;
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem(navigationKey) ?? "null");
    } catch {
      /* Storage is optional. */
    }
    const next = currentRoomView(pact, address, saved);
    setRoom({ ...next, key: navigationKey });
    // Only business progress changes reset the user's chosen view, not polling.
  }, [navigationKey, fingerprint]);
  const navigate = (nextTab: PactRoomTab, nextSelected = selected) => {
    const next = { fingerprint, tab: nextTab, selected: nextSelected };
    setRoom({ ...next, key: navigationKey });
    try {
      localStorage.setItem(navigationKey, JSON.stringify(next));
    } catch {
      /* Private browsing can disable storage. */
    }
  };
  const m = pact?.milestones[selected];
  const refresh = async () => {
    await Promise.all([
      state.refetch(),
      submissions.refetch(),
      jobs.refetch(),
      activity.refetch(),
    ]);
  };
  const perform = async (fn: () => Promise<void>) => {
    setError(undefined);
    setBusy(true);
    try {
      await fn();
      setSyncPending(true);
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const submit = () =>
    perform(async () => {
      if (!wallet || !m) return;
      const prepared = await post<{
        id: string;
        manifestHash: Hex;
        reference: string;
      }>(`/pacts/${escrow}/submissions`, {
        milestoneIndex: selected,
        evidence: items.map((item) => ({
          ...item,
          visibility: "PARTICIPANTS",
          metadata: item.metadata.commit ? item.metadata : {},
        })),
      });
      const hash = await flow.run("transaction.submitMilestone", (hooks) =>
        sdk.submitMilestone(
          wallet,
          escrow,
          BigInt(m.id),
          prepared.manifestHash,
          prepared.reference,
          hooks,
        ),
      );
      localStorage.setItem(`pactflow_pending_${prepared.id}`, hash);
      await confirmOperation(`/submissions/${prepared.id}/confirm`, {
        txHash: hash,
      });
      localStorage.removeItem(`pactflow_pending_${prepared.id}`);
      setItems([
        {
          type: "JSON",
          source: "",
          label: "Evidence",
          metadata: { commit: "" },
        },
      ]);
    });
  const fund = () =>
    perform(async () => {
      if (!pact || !wallet) return;
      const required = BigInt(pact.totalBudget) + BigInt(pact.clientBond);
      if (
        (await sdk.getTokenBalance(pact.settlementToken, wallet.address)) <
        required
      )
        throw new Error(t("v2.insufficient"));
      if (
        (await sdk.getAllowance(pact.settlementToken, wallet.address, escrow)) <
        required
      )
        await flow.run("transaction.approveToken", (hooks) =>
          sdk.approveToken(
            wallet,
            pact.settlementToken,
            escrow,
            required,
            hooks,
          ),
        );
      await flow.run("transaction.fundPact", (hooks) =>
        sdk.fundPact(wallet, escrow, hooks),
      );
    });
  const accept = () =>
    perform(async () => {
      if (!pact || !wallet) return;
      const required = BigInt(pact.workerBond);
      if (
        required &&
        (await sdk.getAllowance(pact.settlementToken, wallet.address, escrow)) <
          required
      )
        await flow.run("transaction.approveWorkerBond", (hooks) =>
          sdk.approveToken(
            wallet,
            pact.settlementToken,
            escrow,
            required,
            hooks,
          ),
        );
      await flow.run("transaction.acceptPact", (hooks) =>
        sdk.acceptPact(wallet, escrow, hooks),
      );
    });
  const verify = () =>
    perform(async () => {
      await post("/verification/jobs", { escrow, milestoneIndex: selected });
    });
  const approve = () =>
    perform(async () => {
      if (!wallet || !m) return;
      const review = await post<{ id: string; reportHash: Hex }>(
        `/pacts/${escrow}/manual-review`,
        { milestoneIndex: selected },
      );
      const txHash = await flow.run("transaction.approveRelease", (hooks) =>
        sdk.approveMilestone(
          wallet,
          escrow,
          BigInt(m.id),
          hooks,
          review.reportHash,
        ),
      );
      await confirmOperation(`/manual-reviews/${review.id}/confirm`, {
        txHash,
      });
    });
  const revise = () =>
    perform(async () => {
      if (!wallet || !m || !reason.trim()) return;
      const hash = hashAgreement({
        reason,
        escrow: escrow.toLowerCase(),
        milestone: selected,
        submission: Number(m.submissionId),
      });
      const txHash = await flow.run("transaction.submitMilestone", (hooks) =>
        sdk.requestRevision(
          wallet,
          escrow,
          BigInt(m.id),
          BigInt(m.submissionId ?? 0),
          hash,
          hooks,
        ),
      );
      await confirmOperation(`/pacts/${escrow}/revision-feedback`, {
        milestoneIndex: selected,
        submissionSequence: Number(m.submissionId),
        reason,
        reasonHash: hash,
        txHash,
      });
      setReason("");
    });
  const cancel = () =>
    perform(async () => {
      if (wallet)
        await flow.run("v2.cancelPact", (hooks) =>
          sdk.cancelPact(wallet, escrow, hooks),
        );
    });
  const dispute = () =>
    perform(async () => {
      if (wallet && m)
        await flow.run("v2.openDispute", (hooks) =>
          sdk.raiseDispute(wallet, escrow, BigInt(m.id), hooks),
        );
    });
  const expire = () =>
    perform(async () => {
      if (wallet && m)
        await flow.run("v2.openDispute", (hooks) =>
          sdk.expireMilestone(wallet, escrow, BigInt(m.id), hooks),
        );
    });
  const claim = () =>
    perform(async () => {
      if (wallet && m)
        await flow.run("transaction.approveRelease", (hooks) =>
          sdk.claimReviewTimeout(wallet, escrow, BigInt(m.id), hooks),
        );
    });
  const resolve = () =>
    perform(async () => {
      if (wallet && m)
        await flow.run("transaction.approveRelease", (hooks) =>
          sdk.resolveDispute(
            wallet,
            escrow,
            BigInt(m.id),
            parseUnits(award, 6),
            0n,
            0n,
            hooks,
          ),
        );
    });
  const upload = async (file: File, index: number) => {
    setBusy(true);
    setError(undefined);
    try {
      const token = localStorage.getItem("pactflow_session");
      const response = await fetch(
        `${API}/api/v1/uploads?name=${encodeURIComponent(file.name)}&mime=${encodeURIComponent(file.type || "application/octet-stream")}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            Authorization: `Bearer ${token}`,
          },
          body: file,
        },
      );
      if (!response.ok) throw new Error("UPLOAD_FAILED");
      const result = await response.json();
      setItems((old) =>
        old.map((item, i) =>
          i === index ? { ...item, source: result.id, label: file.name } : item,
        ),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (!pact)
    return (
      <main className="shell">
        <h1>{t("v2.agreement")}</h1>
        {state.isLoading ? (
          <div className="skeleton" />
        ) : (
          <>
            <p>{t("v2.syncPending")}</p>
            <ErrorMessage error={state.error} />
            <button onClick={() => state.refetch()}>{t("v2.retry")}</button>
          </>
        )}
      </main>
    );
  return (
    <main className="shell pact-room">
      <div className="eyebrow">Pact · V2 · {escrow.slice(0, 10)}</div>
      <h1>{spec.data?.spec.title ?? t("v2.agreement")}</h1>
      <span className={`pill ${pact.status === "Completed" ? "verified" : ""}`}>
        {pactStatusLabel(pact.status, t)}
      </span>
      <div className="actions small">
        <span>
          {t("v2.client")} · {pact.client.slice(0, 10)}
        </span>
        <span>
          {t("v2.builder")} · {(pact.worker ?? pact.fixedWorker)?.slice(0, 10)}
        </span>
      </div>
      <div className="pact-room-grid">
        <div>
          <div
            role="tablist"
            aria-label={t("v2.agreement")}
            className="pact-tabs"
          >
            {tabs.map((key, index) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : undefined;
                  if (next === undefined) return;
                  event.preventDefault();
                  navigate(tabs[next]);
                  const buttons =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]',
                    );
                  buttons?.[next]?.focus();
                }}
                onClick={() => navigate(key)}
              >
                {t(`v2.${key}`)}
              </button>
            ))}
          </div>
          {syncPending && (
            <p className="small" role="status">
              {t("v2.syncPending")}
            </p>
          )}
          {error instanceof ApiError ? (
            <ErrorMessage error={error} />
          ) : (
            !!error && (
              <p role="alert" className="notice error">
                {t(readableError(error).code)}
              </p>
            )
          )}
          {pendingConfirmation && user && (
            <button
              disabled={busy || flow.busy}
              className="secondary"
              onClick={() =>
                perform(() =>
                  confirmOperation(
                    pendingConfirmation.path,
                    pendingConfirmation.body,
                  ),
                )
              }
            >
              {t("v2.recoverSubmission")}
            </button>
          )}
          {!user && <SignInCard />}
          <section role="tabpanel" id={`panel-${tab}`} className="card">
            {tab === "overview" && (
              <>
                <h2>{t("v2.outcome")}</h2>
                <p className="preserve">
                  {spec.data?.spec.outcome ?? t("v2.private")}
                </p>
                <div className="large-amount">
                  {formatUnits(BigInt(pact.totalBudget), 6)} USDC
                </div>
                <p>{t("v2.termsFrozen")}</p>
                <p>{t("v2.privacy")}</p>
                {client && ["Created", "Funded"].includes(pact.status) && (
                  <button
                    className="secondary"
                    disabled={busy || flow.busy}
                    onClick={cancel}
                  >
                    {t("v2.cancelPact")}
                  </button>
                )}
                {pact.status === "Created" && client && (
                  <button disabled={busy || flow.busy} onClick={fund}>
                    {t("v2.fund")}
                  </button>
                )}
                {pact.status === "Funded" &&
                  pact.fixedWorker?.toLowerCase() ===
                    address?.toLowerCase() && (
                    <button disabled={busy || flow.busy} onClick={accept}>
                      {t("v2.accept")}
                    </button>
                  )}
                {pact.status === "Completed" && user && (client || builder) && (
                  <PactReceipt
                    key={`${escrow}-${address}`}
                    escrow={escrow}
                    address={address!}
                    role={client ? "client" : "worker"}
                    defaultTitle={spec.data?.spec.title ?? "PactFlow"}
                  />
                )}
              </>
            )}
            {tab === "milestones" && (
              <>
                {pact.milestones.map((milestone, i) => (
                  <section className="submission-card" key={milestone.id}>
                    <h3>
                      {spec.data?.spec.milestones[i]?.title ??
                        `${t("v2.milestones")} ${i + 1}`}
                    </h3>
                    <strong>
                      {formatUnits(BigInt(milestone.amount), 6)} USDC
                    </strong>
                    <p>
                      {new Date(Number(milestone.dueAt) * 1000).toLocaleString(
                        locale,
                      )}
                    </p>
                    <p className="preserve">
                      {spec.data?.spec.milestones[i]?.acceptanceCriteria?.join(
                        "\n",
                      ) ?? t("v2.private")}
                    </p>
                    <p>
                      {t("v2.revisionLimit")}: {milestone.maxRevisions ?? 2}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        navigate("evidence", i);
                      }}
                    >
                      {t("v2.evidence")} →
                    </button>
                  </section>
                ))}
              </>
            )}
            {(tab === "evidence" || tab === "verification") && (
              <>
                <label className="pact-milestone-picker">
                  {t("v2.milestones")}
                  <select
                    aria-label={t("v2.milestones")}
                    value={selected}
                    onChange={(e) => navigate(tab, Number(e.target.value))}
                  >
                    {pact.milestones.map((m, i) => (
                      <option key={m.id} value={i}>
                        {spec.data?.spec.milestones[i]?.title ?? `${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
                {m?.status === "RevisionRequired" && (
                  <div className="revision-notice">
                    <strong>{t("v2.revision")}</strong>
                    <p>{t("v2.securityNote")}</p>
                    {jobs.data
                      ?.filter(
                        (j) =>
                          j.milestoneIndex === selected &&
                          j.status === "FAILED",
                      )
                      .map((j) => (
                        <p key={j.id}>
                          <Link href={`/verifications/${j.id}`}>
                            {t("v2.verification")} #{j.submissionSequence} ↗
                          </Link>
                        </p>
                      ))}
                  </div>
                )}
                {tab === "evidence" &&
                  builder &&
                  m &&
                  ["Pending", "RevisionRequired"].includes(m.status) && (
                    <>
                      <h3>
                        {t(
                          m.status === "RevisionRequired"
                            ? "v2.resubmit"
                            : "v2.submit",
                        )}
                      </h3>
                      {items.map((item, i) => (
                        <section key={i} className="submission-card">
                          <label>
                            {t("v2.type")}
                            <select
                              aria-label={t("v2.type")}
                              value={item.type}
                              onChange={(e) =>
                                setItems((old) =>
                                  old.map((x, n) =>
                                    n === i
                                      ? { ...x, type: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            >
                              {[
                                "JSON",
                                "TEXT",
                                "DEPLOYMENT_URL",
                                "GITHUB_REPOSITORY",
                                "PULL_REQUEST",
                                "FILE",
                                "IMAGE",
                                "API_ENDPOINT",
                                "TRANSACTION",
                                "OTHER_URL",
                              ].map((type) => (
                                <option
                                  key={type}
                                  value={type}
                                  disabled={
                                    ["FILE", "IMAGE"].includes(type) &&
                                    !capabilities.data?.uploads?.available
                                  }
                                >
                                  {evidenceTypeLabel(type, t)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {t("v2.label")}
                            <input
                              value={item.label}
                              onChange={(e) =>
                                setItems((old) =>
                                  old.map((x, n) =>
                                    n === i
                                      ? { ...x, label: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </label>
                          {["FILE", "IMAGE"].includes(item.type) ? (
                            <>
                              <label>
                                {t("v2.upload")}
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
                                  onChange={(e) => {
                                    if (e.target.files?.[0])
                                      void upload(e.target.files[0], i);
                                  }}
                                />
                              </label>
                              <p className="small">{t("v2.uploadHelp")}</p>
                            </>
                          ) : (
                            <label>
                              {t("v2.content")}
                              <textarea
                                value={item.source}
                                onChange={(e) =>
                                  setItems((old) =>
                                    old.map((x, n) =>
                                      n === i
                                        ? { ...x, source: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </label>
                          )}
                          {["GITHUB_REPOSITORY", "PULL_REQUEST"].includes(
                            item.type,
                          ) && (
                            <label>
                              {t("v2.commit")}
                              <input
                                value={item.metadata.commit}
                                onChange={(e) =>
                                  setItems((old) =>
                                    old.map((x, n) =>
                                      n === i
                                        ? {
                                            ...x,
                                            metadata: {
                                              commit: e.target.value,
                                            },
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </label>
                          )}
                        </section>
                      ))}
                      <div className="actions">
                        <button
                          className="secondary"
                          onClick={() =>
                            setItems((old) => [
                              ...old,
                              {
                                type: "TEXT",
                                source: "",
                                label: "Evidence",
                                metadata: { commit: "" },
                              },
                            ])
                          }
                        >
                          {t("v2.addEvidence")}
                        </button>
                        <button
                          disabled={
                            busy || flow.busy || items.some((i) => !i.source)
                          }
                          onClick={submit}
                        >
                          {t(
                            m.status === "RevisionRequired"
                              ? "v2.resubmit"
                              : "v2.submit",
                          )}
                        </button>
                      </div>
                    </>
                  )}
                {m?.status === "Submitted" && user && (
                  <PactReviewPanel
                    automated={m.mode !== "ClientOnly" && !m.aiAttested}
                    manual={
                      client &&
                      !m.clientApproved &&
                      (m.mode === "ClientOnly" || m.mode === "Hybrid")
                    }
                    busy={busy || flow.busy}
                    reason={reason}
                    onReason={setReason}
                    onVerify={verify}
                    onApprove={approve}
                    onRevise={revise}
                  />
                )}
                {m &&
                  ["Submitted", "RevisionRequired"].includes(m.status) &&
                  (client || builder) &&
                  m.reviewDeadline &&
                  Number(m.reviewDeadline) >= Date.now() / 1000 && (
                    <button
                      className="secondary pact-dispute"
                      disabled={busy || flow.busy}
                      onClick={dispute}
                    >
                      {t("v2.openDispute")}
                    </button>
                  )}
                {m &&
                  ["Pending", "RevisionRequired"].includes(m.status) &&
                  Number(m.dueAt) < Date.now() / 1000 &&
                  user && (
                    <button disabled={busy || flow.busy} onClick={expire}>
                      {t("v2.expire")}
                    </button>
                  )}
                {m?.status === "Submitted" &&
                  builder &&
                  m.reviewDeadline &&
                  Number(m.reviewDeadline) < Date.now() / 1000 &&
                  (m.mode === "ClientOnly" ||
                    (m.mode === "Hybrid" && m.aiAttested)) && (
                    <button disabled={busy || flow.busy} onClick={claim}>
                      {t("v2.claimTimeout")}
                    </button>
                  )}
                {m?.status === "Disputed" &&
                  pact.arbitrator.toLowerCase() === address?.toLowerCase() && (
                    <>
                      <label>
                        {t("v2.workerAward")}
                        <input
                          value={award}
                          onChange={(e) => setAward(e.target.value)}
                        />
                      </label>
                      <button disabled={busy || flow.busy} onClick={resolve}>
                        {t("v2.resolve")}
                      </button>
                    </>
                  )}
                {tab === "verification" &&
                  audit.data
                    ?.filter(
                      (e) =>
                        e.type === "ManualReviewPrepared" &&
                        e.payload.report?.milestone === selected,
                    )
                    .map((e) => (
                      <section key={e.id} className="submission-card">
                        <h3>
                          {t("v2.manual")} #{e.payload.report?.submission}
                        </h3>
                        <p className="mono small">{e.payload.reportHash}</p>
                      </section>
                    ))}
                {m?.status === "RevisionRequired" &&
                  audit.data
                    ?.filter((e) => e.type === "RevisionFeedback")
                    .map((e) => (
                      <p key={e.id} className="preserve">
                        {e.payload.reason}
                      </p>
                    ))}
                {tab === "verification" &&
                  jobs.data
                    ?.filter((j) => j.milestoneIndex === selected)
                    .map((j) => (
                      <div className="submission-card" key={j.id}>
                        <Link href={`/verifications/${j.id}`}>
                          {t("v2.verification")} #{j.submissionSequence}
                        </Link>
                        <p>
                          {j.status === "FAILED"
                            ? t("v2.revision")
                            : j.status === "PASSED"
                              ? t("verification.verified")
                              : j.status === "ERROR"
                                ? t("v2.error")
                                : t("v2.processing")}
                          {j.score !== null ? ` · ${j.score}/100` : ""}
                        </p>
                      </div>
                    ))}
                {(tab === "evidence" || tab === "verification") && (
                  <>
                    <h3>{t("v2.history")}</h3>
                    {submissions.data
                      ?.filter((s) => s.milestoneIndex === selected)
                      .map((s) => (
                        <details
                          className="submission-card"
                          key={s.id}
                          open={
                            tab === "verification" &&
                            String(s.sequence) === m?.submissionId
                          }
                        >
                          <summary>
                            {t("v2.sequence", { number: s.sequence })} ·{" "}
                            {s.status === "CONFIRMED"
                              ? t("transaction.finalized")
                              : t("v2.processing")}
                          </summary>
                          <p className="small">
                            {new Date(s.createdAt).toLocaleString(locale)}
                          </p>
                          {s.manifest.evidence.map((e) => (
                            <div key={e.id}>
                              <strong>{e.label}</strong>
                              <p className="preserve small">{e.source}</p>
                              {["FILE", "IMAGE"].includes(e.type) && (
                                <button
                                  className="secondary"
                                  onClick={() =>
                                    perform(async () => {
                                      const link = await api<{ url: string }>(
                                        `/uploads/${e.source}/download`,
                                      );
                                      window.location.assign(link.url);
                                    })
                                  }
                                >
                                  {t("v2.download")}
                                </button>
                              )}
                            </div>
                          ))}
                        </details>
                      ))}
                  </>
                )}
              </>
            )}
            {tab === "activity" &&
              (activity.data?.items.length ? (
                <ActivityList items={activity.data.items} />
              ) : (
                <p>{t("v2.noActivity")}</p>
              ))}
          </section>
          <TransactionTimeline steps={flow.steps} />
        </div>
        <aside>
          <TrustPanel pact={pact} />
        </aside>
      </div>
    </main>
  );
}
