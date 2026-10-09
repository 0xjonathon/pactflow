"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { parseUnits, zeroAddress, type Address } from "viem";
import {
  hashAgreement,
  dataUriForAgreement,
  type CanonicalValue,
} from "@pactflow/sdk";
import {
  hashVerificationPolicy,
  type VerificationPolicy,
} from "@pactflow/verifier/policy";
import { useI18n, type MessageKey, formatDate } from "../lib/i18n";
import {
  api,
  ApiError,
  useData,
  post,
  useSession,
  SignInCard,
  ErrorMessage,
  type Job,
  type Proposal,
  methodLabel,
  rawAmount,
} from "../lib/product";
import { platformArbitrator } from "../lib/platform";
import { protocolSdk } from "../lib/protocol";
import {
  validatePactPayment,
  type PaymentField,
  type PaymentIssue,
} from "../lib/pact-payment-validation";
import { usePactWalletAdapter } from "../lib/wallet-adapter";
import { NetworkGuard } from "./WalletBar";
import { WorkJourney } from "./WorkJourney";
import {
  TransactionTimeline,
  useTransactionFlow,
  readableError,
} from "../features/transaction/useTransactionFlow";
const localDate = (milliseconds: number) => {
  const d = new Date(milliseconds);
  return new Date(milliseconds - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
type DraftSpec = {
  version: number;
  visibility: string;
  outcome: string;
  title: string;
  description: string;
  client: Address;
  worker: Address;
  arbitrator: Address;
  token: Address;
  totalBudget: string;
  clientBond: string;
  workerBond: string;
  acceptanceDeadline: string;
  reviewPeriod: string;
  maxRevisions: number;
  verifier: Address;
  policy: VerificationPolicy | null;
  milestones: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
    requiredEvidence: string[];
    amount: string;
    dueAt: string;
    verificationMode: Job["verificationMode"];
    verificationPolicy?: VerificationPolicy;
  }>;
};
const canonical = (spec: DraftSpec) => spec as unknown as CanonicalValue;
export function CollaborationDraft({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const { address } = useAccount();
  const wallet = usePactWalletAdapter();
  const flow = useTransactionFlow();
  const data = useData<{
    job: Job;
    proposal: Proposal;
    clientAddress: Address;
  }>(`draft-${id}`, `/jobs/${id}/pact-draft`, !!user);
  const [error, setError] = useState<unknown>();
  const [technicalError, setTechnicalError] = useState("");
  const [escrow, setEscrow] = useState<Address>();
  const [frozen, setFrozen] = useState<DraftSpec>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const started = useRef("");
  const submitting = useRef(false);
  const [arb, setArb] = useState(platformArbitrator);
  const [acceptBy, setAcceptBy] = useState("");
  const [hours, setHours] = useState("24");
  const [revisions, setRevisions] = useState("2");
  const [issues, setIssues] = useState<PaymentIssue[]>([]);
  useEffect(() => {
    if (!data.data || started.current === id) return;
    started.current = id;
    const job = data.data.job;
    const now = Date.now();
    setAcceptBy(
      localDate(
        Math.min(
          now + 86400000,
          now + (Date.parse(job.milestones[0].dueAt) - now) / 2,
        ),
      ),
    );
    const current =
      job.escrowAddress ||
      window.localStorage.getItem(`pactflow_job_escrow_${id}`);
    if (!current) {
      setReady(true);
      return;
    }
    setEscrow(current as Address);
    void (async () => {
      try {
        const saved = localStorage.getItem(
          `pactflow_agreement_${current.toLowerCase()}`,
        );
        const spec: DraftSpec = saved?.startsWith("data:application/json")
          ? JSON.parse(decodeURIComponent(saved.split(",").slice(1).join(",")))
          : (await api<{ spec: DraftSpec }>(`/pacts/${current}/spec`)).spec;
        setFrozen(spec);
        setArb(spec.arbitrator);
        setAcceptBy(localDate(Number(spec.acceptanceDeadline) * 1000));
        setHours(String(Number(spec.reviewPeriod) / 3600));
        setRevisions(String(spec.maxRevisions));
      } catch {
        setError(new ApiError("DRAFT_RECOVERY_REQUIRED"));
      } finally {
        setReady(true);
      }
    })();
  }, [data.data, id]);
  const confirm = async () => {
    if (!data.data || !wallet || !address || submitting.current || !ready)
      return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    setTechnicalError("");
    setIssues([]);
    const { job, proposal, clientAddress } = data.data;
    try {
      if (address.toLowerCase() !== clientAddress.toLowerCase())
        throw new ApiError("ONLY_CLIENT");
      if (!escrow) {
        const invalid = validatePactPayment({
          client: address,
          worker: proposal.workerAddress,
          arbitrator: arb,
          acceptBy,
          hours,
          revisions,
          deliveries: job.milestones.map((m) => ({
            amount: m.amount,
            due: m.dueAt,
          })),
        });
        if (invalid.length) {
          setIssues(invalid);
          requestAnimationFrame(() =>
            document.getElementById(`draft-${invalid[0].field}`)?.focus(),
          );
          return;
        }
      } else if (!frozen) throw new ApiError("DRAFT_RECOVERY_REQUIRED");
      const sdk = protocolSdk();
      if (sdk.addresses.version !== 2) throw new Error("V2_NOT_CONFIGURED");
      const policy = job.policy as VerificationPolicy | null;
      const spec: DraftSpec = frozen ?? {
        version: 2,
        visibility: "PARTICIPANTS",
        outcome: job.description,
        title: job.title,
        description: job.description,
        client: address,
        worker: proposal.workerAddress as Address,
        arbitrator: arb.trim() as Address,
        token: sdk.addresses.SettlementToken,
        totalBudget: parseUnits(job.budget, 6).toString(),
        clientBond: parseUnits(job.clientDeposit, 6).toString(),
        workerBond: parseUnits(job.workerDeposit, 6).toString(),
        acceptanceDeadline: String(Math.floor(Date.parse(acceptBy) / 1000)),
        reviewPeriod: String(Math.floor(Number(hours) * 3600)),
        maxRevisions: Number(revisions),
        verifier: (process.env.NEXT_PUBLIC_VERIFIER_ADDRESS ||
          zeroAddress) as Address,
        policy,
        milestones: job.milestones.map((m) => ({
          title: m.title,
          description: job.requirements,
          acceptanceCriteria: (job.requirements || job.description)
            .split("\n")
            .filter(Boolean),
          requiredEvidence: [policy ? "JSON" : "TEXT"],
          amount: parseUnits(m.amount, 6).toString(),
          dueAt: String(Math.floor(Date.parse(m.dueAt) / 1000)),
          verificationMode: job.verificationMode,
          ...(policy ? { verificationPolicy: policy } : {}),
        })),
      };
      if (spec.policy && spec.verifier === zeroAddress)
        throw new Error("VERIFIER_NOT_CONFIGURED");
      let current = escrow;
      if (!current) {
        const balance = await sdk.getTokenBalance(spec.token, address);
        if (balance < BigInt(spec.totalBudget) + BigInt(spec.clientBond))
          throw new Error("PACT_INSUFFICIENT");
        const created = await flow.run("transaction.createPact", (hooks) =>
          sdk.createPact(
            wallet,
            {
              protocolVersion: 2,
              agreementHash: hashAgreement(canonical(spec)),
              client: spec.client,
              worker: spec.worker,
              token: spec.token,
              arbitrator: spec.arbitrator,
              totalBudget: BigInt(spec.totalBudget),
              clientBond: BigInt(spec.clientBond),
              workerBond: BigInt(spec.workerBond),
              acceptanceDeadline: BigInt(spec.acceptanceDeadline),
              reviewPeriod: BigInt(spec.reviewPeriod),
              milestones: spec.milestones.map((m) => ({
                amount: BigInt(m.amount),
                dueAt: BigInt(m.dueAt),
                rulesHash: m.verificationPolicy
                  ? hashVerificationPolicy(m.verificationPolicy)
                  : hashAgreement(canonical(spec)),
                maxRevisions: spec.maxRevisions,
                verifier: spec.verifier,
                mode:
                  m.verificationMode === "ClientOnly"
                    ? 0
                    : m.verificationMode === "AIOnly"
                      ? 1
                      : 2,
              })),
            },
            hooks,
          ),
        );
        current = created.escrowAddress;
        // Freeze before any API request: interrupted upload/link/funding retries reuse this escrow and these exact terms.
        setEscrow(current);
        setFrozen(spec);
        localStorage.setItem(`pactflow_job_escrow_${id}`, current);
        localStorage.setItem(
          `pactflow_agreement_${current.toLowerCase()}`,
          dataUriForAgreement(canonical(spec)),
        );
      }
      const state = await sdk.getPact(current);
      if (
        state.agreementHash.toLowerCase() !==
        hashAgreement(canonical(spec)).toLowerCase()
      )
        throw new ApiError("DRAFT_RECOVERY_REQUIRED");
      await post(`/pacts/${current}/spec`, canonical(spec));
      await post<Job>(`/jobs/${id}/pact`, { escrow: current });
      for (const [i, milestone] of spec.milestones.entries())
        if (milestone.verificationPolicy)
          await post("/verification/policies", {
            escrow: current,
            milestoneIndex: i,
            policy: milestone.verificationPolicy,
          });
      if (state.status === "Created") {
        const required = state.totalBudget + state.clientBond;
        if (
          (await sdk.getTokenBalance(state.settlementToken, address)) < required
        )
          throw new Error("PACT_INSUFFICIENT");
        if (
          (await sdk.getAllowance(state.settlementToken, address, current)) <
          required
        )
          await flow.run("transaction.approveToken", (hooks) =>
            sdk.approveToken(
              wallet,
              state.settlementToken,
              current!,
              required,
              hooks,
            ),
          );
        await flow.run("transaction.fundPact", (hooks) =>
          sdk.fundPact(wallet, current!, hooks),
        );
      }
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError) setError(e);
      else {
        const key: Record<string, MessageKey> = {
          V2_NOT_CONFIGURED: "v2.v2NotConfigured",
          VERIFIER_NOT_CONFIGURED: "v2.verifierNotConfigured",
          PACT_INSUFFICIENT: "v2.insufficient",
        };
        setTechnicalError(
          t(key[e instanceof Error ? e.message : ""] ?? readableError(e).code),
        );
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const field = (
    key: PaymentField,
    label: MessageKey,
    hint: MessageKey,
    input: ReactNode,
  ) => (
    <div className="wizard-field">
      <label htmlFor={`draft-${key}`}>{t(label)}</label>
      {input}
      <p className="field-hint" id={`draft-${key}-hint`}>
        {t(hint)}
      </p>
      {issues
        .filter((i) => i.field === key)
        .map((i) => (
          <p
            key={i.code}
            className="field-error"
            id={`draft-${key}-error`}
            role="alert"
          >
            {t(i.code)}
          </p>
        ))}
    </div>
  );
  const props = (key: PaymentField) => ({
    id: `draft-${key}`,
    disabled: !!escrow || busy || !ready,
    "aria-invalid": issues.some((i) => i.field === key),
    "aria-describedby": `draft-${key}-hint${issues.some((i) => i.field === key) ? ` draft-${key}-error` : ""}`,
  });
  const job = data.data?.job;
  return (
    <main className="shell narrow">
      <h1>{t("jobs.reviewDraft")}</h1>
      <WorkJourney step={2} />
      {!user ? (
        <SignInCard />
      ) : data.error ? (
        <ErrorMessage error={data.error} />
      ) : !job || !ready ? (
        <p role="status">{t("journey.draftLoading")}</p>
      ) : (
        <section className="card">
          <Link className="back-link" href={`/jobs/${id}`}>
            ← {t("journey.returnBrief")}
          </Link>
          <h2>{job.title}</h2>
          <p>{job.description}</p>
          <p className="notice">{t("journey.termsBeforeFunds")}</p>
          <div className="selected-partner">
            <p className="small">{t("journey.selectedPartner")}</p>
            <Link href={`/u/${data.data!.proposal.worker.handle}`}>
              <strong>{data.data!.proposal.worker.displayName}</strong>
            </Link>
            <p>
              <code>{data.data!.proposal.workerAddress}</code>
            </p>
            <p className="small">{t("journey.automaticWallet")}</p>
          </div>
          <p className="small">{t("journey.requesterWallet")}</p>
          <p className="wallet-reference">{data.data!.clientAddress}</p>
          <div className="row">
            <span>{t("marketplace.budget")}</span>
            <strong>{job.budget} USDC</strong>
          </div>
          <div className="row">
            <span>{t("jobs.clientDeposit")}</span>
            <strong>{job.clientDeposit} USDC</strong>
          </div>
          <div className="row">
            <span>{t("journey.totalToLock")}</span>
            <strong>
              {rawAmount(
                (
                  parseUnits(job.budget, 6) + parseUnits(job.clientDeposit, 6)
                ).toString(),
              )}{" "}
              USDC
            </strong>
          </div>
          <p className="small">{t("journey.depositReturned")}</p>
          <h3>{t("jobs.milestones")}</h3>
          {job.milestones.map((m, i) => (
            <div className="milestone-row" key={i}>
              <div>
                <strong>{m.title}</strong>
                <p className="small">
                  {formatDate(Date.parse(m.dueAt), locale)}
                </p>
              </div>
              <strong>{m.amount} USDC</strong>
            </div>
          ))}
          <p>
            {t("marketplace.verification")}:{" "}
            {methodLabel(job.verificationMode, t)}
          </p>
          <p className="preserve">{job.requirements}</p>
          {escrow && <p className="notice">{t("journey.frozen")}</p>}
          {field(
            "arbitrator",
            "v2.arbitrator",
            "v2.arbitratorHint",
            <input
              {...props("arbitrator")}
              value={arb}
              readOnly
              className="mono"
            />,
          )}
          {field(
            "acceptBy",
            "v2.acceptBy",
            "v2.acceptanceHint",
            <input
              {...props("acceptBy")}
              type="datetime-local"
              value={acceptBy}
              onChange={(e) => {
                setAcceptBy(e.target.value);
                setIssues((v) => v.filter((i) => i.field !== "acceptBy"));
              }}
            />,
          )}
          {field(
            "hours",
            "v2.reviewPeriod",
            "v2.reviewHoursHint",
            <input
              {...props("hours")}
              type="number"
              step="any"
              value={hours}
              onChange={(e) => {
                setHours(e.target.value);
                setIssues((v) => v.filter((i) => i.field !== "hours"));
              }}
            />,
          )}
          {field(
            "revisions",
            "v2.revisionLimit",
            "v2.revisionsHint",
            <input
              {...props("revisions")}
              type="number"
              min="0"
              max="10"
              step="1"
              value={revisions}
              onChange={(e) => {
                setRevisions(e.target.value);
                setIssues((v) => v.filter((i) => i.field !== "revisions"));
              }}
            />,
          )}
          {issues
            .filter(
              (i) =>
                i.field !== "arbitrator" &&
                i.field !== "acceptBy" &&
                i.field !== "hours" &&
                i.field !== "revisions",
            )
            .map((i) => (
              <p className="field-error" role="alert" key={i.field}>
                {t(i.code)}
              </p>
            ))}
          <p>{t("jobs.fundHelp")}</p>
          {done && escrow ? (
            <Link className="button" href={`/pacts/${escrow}`}>
              {t("jobs.openWorkspace")}
            </Link>
          ) : (
            <NetworkGuard>
              <button
                disabled={busy || !ready || (!!escrow && !frozen)}
                onClick={confirm}
              >
                {t("jobs.createCollaboration")}
              </button>
            </NetworkGuard>
          )}
          <ErrorMessage error={error} />
          {technicalError && (
            <p className="notice error" role="alert">
              {technicalError}
            </p>
          )}
        </section>
      )}
      <TransactionTimeline steps={flow.steps} />
    </main>
  );
}
