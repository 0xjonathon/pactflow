"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { isAddress, parseUnits, zeroAddress, type Address } from "viem";
import { hashAgreement, type CanonicalValue } from "@pactflow/sdk";
import {
  hashVerificationPolicy,
  verificationPolicySchema,
  type VerificationPolicy,
} from "@pactflow/verifier/policy";
import { useI18n, evidenceTypeLabel, type MessageKey } from "../lib/i18n";
import {
  post,
  SignInCard,
  useSession,
  ErrorMessage,
  useData,
} from "../lib/product";
import { protocolSdk } from "../lib/protocol";
import { usePactWalletAdapter } from "../lib/wallet-adapter";
import {
  TransactionTimeline,
  useTransactionFlow,
  readableError,
} from "../features/transaction/useTransactionFlow";
import { buildVerificationPolicy } from "../lib/verification";
import { NetworkGuard } from "./WalletBar";
const date = (days: number) => {
  const target = new Date(Date.now() + days * 86400000);
  return new Date(+target - target.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
type Delivery = {
  title: string;
  criteria: string;
  type: string;
  amount: string;
  due: string;
};
export function PactWizard() {
  const { t, locale } = useI18n();
  const [suggesting, setSuggesting] = useState<number>();
  const [suggestions, setSuggestions] = useState<Record<number, string[]>>({});
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"title" | "outcome", MessageKey>>
  >({});
  const { user } = useSession();
  const capabilities = useData<{ ai: boolean }>(
    "verification-capabilities",
    "/verification/capabilities",
  );
  const { address } = useAccount();
  const wallet = usePactWalletAdapter();
  const flow = useTransactionFlow();
  const sdk = useMemo(() => protocolSdk(), []);
  const [step, setStep] = useState(0),
    [title, setTitle] = useState(""),
    [outcome, setOutcome] = useState(""),
    [context, setContext] = useState(""),
    [skills, setSkills] = useState(""),
    [worker, setWorker] = useState(""),
    [arb, setArb] = useState(process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS ?? ""),
    [acceptBy, setAcceptBy] = useState(date(1)),
    [hours, setHours] = useState("24"),
    [revisions, setRevisions] = useState("2"),
    [method, setMethod] = useState("ClientOnly"),
    [preset, setPreset] = useState("JSON"),
    [url, setUrl] = useState(""),
    [schema, setSchema] = useState(
      '{"type":"object","required":["delivered"],"properties":{"delivered":{"const":true}}}',
    ),
    [repo, setRepo] = useState(""),
    [checks, setChecks] = useState(""),
    [appId, setAppId] = useState("15368"),
    [deliveries, setDeliveries] = useState<Delivery[]>([
      { title: "", criteria: "", type: "JSON", amount: "1", due: date(7) },
    ]),
    [error, setError] = useState<unknown>(),
    [escrow, setEscrow] = useState<Address>(),
    [done, setDone] = useState(false);
  const steps = [
    "stepsOutcome",
    "stepsDeliverables",
    "stepsVerification",
    "stepsPayment",
    "stepsReview",
  ] as const;
  const update = (i: number, patch: Partial<Delivery>) =>
    setDeliveries((items) =>
      items.map((d, n) => (n === i ? { ...d, ...patch } : d)),
    );
  const policy = (deliveryIndex = 0): VerificationPolicy | null =>
    method === "ClientOnly"
      ? null
      : preset === "WEBSITE"
        ? buildVerificationPolicy({
            preset: "WEBSITE",
            mode: method === "Hybrid" ? "HYBRID" : "AI_ONLY",
            url,
            requiredText: deliveries[deliveryIndex].criteria.split("\n")[0],
            selector: "",
            minPerformance: 0,
            semanticRequirement: "",
            minScore: 100,
          })
        : verificationPolicySchema.parse({
            version: 1,
            name: preset === "GITHUB_CI" ? "GitHub CI" : "JSON evidence",
            mode: method === "Hybrid" ? "HYBRID" : "AI_ONLY",
            minScore: preset === "SEMANTIC" ? 80 : 100,
            requireAllMandatoryRules: true,
            semanticVerificationEnabled: preset === "SEMANTIC",
            rules:
              preset === "SEMANTIC"
                ? [
                    {
                      id: "acceptance-schema",
                      type: "JSON_SCHEMA",
                      schema: JSON.parse(schema),
                      required: true,
                      weight: 40,
                    },
                    {
                      id: "outcome-match",
                      type: "LLM_RUBRIC",
                      rubric: outcome.slice(0, 2000),
                      criteria: deliveries[deliveryIndex].criteria
                        .split("\n")
                        .filter(Boolean),
                      required: true,
                      weight: 60,
                    },
                  ]
                : preset === "GITHUB_CI"
                  ? [
                      {
                        id: "required-ci",
                        type: "GITHUB_CI",
                        repository: repo,
                        requiredChecks: checks
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        requiredAppId: Number(appId),
                        required: true,
                        weight: 100,
                      },
                    ]
                  : [
                      {
                        id: "acceptance-schema",
                        type: "JSON_SCHEMA",
                        schema: JSON.parse(schema),
                        required: true,
                        weight: 100,
                      },
                    ],
          });
  const validStep = () => {
    if (step === 1)
      return deliveries.every((d) => d.title.trim() && d.criteria.trim());
    if (step === 2) {
      policy();
      return true;
    }
    if (step === 3)
      return (
        isAddress(worker) &&
        isAddress(arb) &&
        new Set([
          address?.toLowerCase(),
          worker.toLowerCase(),
          arb.toLowerCase(),
        ]).size === 3 &&
        deliveries.every(
          (d, i) =>
            parseUnits(d.amount, 6) > 0n &&
            Date.parse(d.due) >
              (i ? Date.parse(deliveries[i - 1].due) : Date.parse(acceptBy)),
        ) &&
        Date.parse(acceptBy) > Date.now() &&
        Number(revisions) >= 0 &&
        Number(revisions) <= 10 &&
        Number(hours) > 0 &&
        Number(hours) <= 720
      );
    return true;
  };
  const next = () => {
    setError(undefined);
    if (step === 0) {
      const issues: typeof fieldErrors = {};
      if (!title.trim()) issues.title = "v2.titleRequired";
      else if (title.trim().length > 160) issues.title = "v2.titleTooLong";
      if (!outcome.trim()) issues.outcome = "v2.outcomeRequired";
      else if (outcome.trim().length > 12000)
        issues.outcome = "v2.outcomeTooLong";
      setFieldErrors(issues);
      if (issues.title || issues.outcome) {
        document
          .getElementById(issues.title ? "pact-title" : "pact-outcome")
          ?.focus();
        return;
      }
    }
    try {
      if (!validStep()) throw new Error(t("v2.validation"));
      setStep((s) => s + 1);
    } catch (e) {
      setError(e);
    }
  };
  const confirm = async () => {
    if (!wallet || !address) return;
    setError(undefined);
    try {
      if (sdk.addresses.version !== 2) throw new Error("V2_NOT_CONFIGURED");
      const verifier = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS ?? zeroAddress;
      if (
        method !== "ClientOnly" &&
        (!isAddress(verifier) || verifier === zeroAddress)
      )
        throw new Error("VERIFIER_NOT_CONFIGURED");
      const policies = deliveries.map((_, index) => policy(index));
      const p = policies[0];
      const milestones = deliveries.map((d) => ({
        title: d.title,
        acceptanceCriteria: d.criteria.split("\n").filter(Boolean),
        requiredEvidence: [d.type],
        amount: parseUnits(d.amount, 6).toString(),
        dueAt: String(Math.floor(Date.parse(d.due) / 1000)),
      }));
      const total = milestones.reduce((n, m) => n + BigInt(m.amount), 0n);
      const spec = {
        version: 2,
        title: title.trim(),
        outcome: outcome.trim(),
        context,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        visibility: "PARTICIPANTS",
        client: address,
        worker,
        arbitrator: arb,
        token: sdk.addresses.SettlementToken,
        totalBudget: total.toString(),
        clientBond: "0",
        workerBond: "0",
        acceptanceDeadline: String(Math.floor(Date.parse(acceptBy) / 1000)),
        reviewPeriod: String(Math.floor(Number(hours) * 3600)),
        maxRevisions: Number(revisions),
        milestones,
        verifier,
        policy: p,
        policies,
      };
      let current = escrow;
      if (!current) {
        const result = await flow.run("transaction.createPact", (hooks) =>
          sdk.createPact(
            wallet,
            {
              protocolVersion: 2,
              agreementHash: hashAgreement(spec as unknown as CanonicalValue),
              client: address,
              worker: worker as Address,
              arbitrator: arb as Address,
              token: sdk.addresses.SettlementToken,
              totalBudget: total,
              clientBond: 0n,
              workerBond: 0n,
              acceptanceDeadline: BigInt(spec.acceptanceDeadline),
              reviewPeriod: BigInt(spec.reviewPeriod),
              milestones: milestones.map((m, index) => ({
                amount: BigInt(m.amount),
                dueAt: BigInt(m.dueAt),
                rulesHash: policies[index]
                  ? hashVerificationPolicy(policies[index])
                  : hashAgreement(m),
                mode: method === "ClientOnly" ? 0 : method === "Hybrid" ? 2 : 1,
                maxRevisions: Number(revisions),
                verifier: verifier as Address,
              })),
            },
            hooks,
          ),
        );
        current = result.escrowAddress;
        setEscrow(current);
        window.localStorage.setItem(
          `pactflow_spec_${current.toLowerCase()}`,
          JSON.stringify(spec),
        );
      }
      const frozen = JSON.parse(
        window.localStorage.getItem(`pactflow_spec_${current.toLowerCase()}`) ??
          JSON.stringify(spec),
      );
      await post(`/pacts/${current}/spec`, frozen);
      if (p)
        for (let i = 0; i < milestones.length; i++)
          await post("/verification/policies", {
            escrow: current,
            milestoneIndex: i,
            policy: policies[i],
            policies,
          });
      const state = await sdk.getPact(current);
      if (state.status === "Created") {
        const balance = await sdk.getTokenBalance(
          state.settlementToken,
          address,
        );
        if (balance < state.totalBudget + state.clientBond)
          throw new Error(t("v2.insufficient"));
        const allowance = await sdk.getAllowance(
          state.settlementToken,
          address,
          current,
        );
        if (allowance < state.totalBudget + state.clientBond)
          await flow.run("transaction.approveToken", (hooks) =>
            sdk.approveToken(
              wallet,
              state.settlementToken,
              current!,
              state.totalBudget + state.clientBond,
              hooks,
            ),
          );
        await flow.run("transaction.fundPact", (hooks) =>
          sdk.fundPact(wallet, current!, hooks),
        );
      }
      setDone(true);
    } catch (e) {
      setError(e);
    }
  };
  if (!user)
    return (
      <main className="shell narrow">
        <h1>{t("v2.create")}</h1>
        <SignInCard />
      </main>
    );
  return (
    <main className="shell narrow">
      <p className="eyebrow">{t("v2.networkName")}</p>
      <h1>{t("v2.create")}</h1>
      {sdk.addresses.version !== 2 && (
        <p className="notice">{t("v2.v2NotConfigured")}</p>
      )}
      {done && escrow ? (
        <section className="card">
          <h2>{t("v2.money")}</h2>
          <p>{title}</p>
          <Link className="button" href={`/pacts/${escrow}`}>
            {t("navigation.openPact")}
          </Link>
        </section>
      ) : (
        <>
          <ol className="wizard-navigation">
            {steps.map((key, i) => (
              <li key={key}>
                <button
                  disabled={i > step || !!escrow}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                >
                  <span>{i + 1}</span>
                  <small>{t(`v2.${key}`)}</small>
                </button>
              </li>
            ))}
          </ol>
          <section className="card wizard">
            {step === 0 && (
              <>
                <h2>{t("v2.outcomeQuestion")}</h2>
                <label>
                  {t("v2.title")}
                  <input
                    id="pact-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        title: undefined,
                      }));
                    }}
                    aria-invalid={!!fieldErrors.title}
                    aria-describedby={
                      fieldErrors.title ? "pact-title-error" : undefined
                    }
                    required
                  />
                </label>
                {fieldErrors.title && (
                  <p id="pact-title-error" className="field-error" role="alert">
                    {t(fieldErrors.title)}
                  </p>
                )}
                <label>
                  {t("v2.outcome")}
                  <textarea
                    id="pact-outcome"
                    value={outcome}
                    onChange={(e) => {
                      setOutcome(e.target.value);
                      setFieldErrors((current) => ({
                        ...current,
                        outcome: undefined,
                      }));
                    }}
                    aria-invalid={!!fieldErrors.outcome}
                    aria-describedby={
                      fieldErrors.outcome ? "pact-outcome-error" : undefined
                    }
                    required
                  />
                </label>
                {fieldErrors.outcome && (
                  <p
                    id="pact-outcome-error"
                    className="field-error"
                    role="alert"
                  >
                    {t(fieldErrors.outcome)}
                  </p>
                )}
                <label>
                  {t("v2.context")}
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                  />
                </label>
                <label>
                  {t("v2.skills")}
                  <input
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                  />
                </label>
              </>
            )}
            {step === 1 && (
              <>
                <h2>{t("v2.stepsDeliverables")}</h2>
                {deliveries.map((d, i) => (
                  <section className="submission-card" key={i}>
                    <label>
                      {t("v2.deliverable")} {i + 1}
                      <input
                        value={d.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                      />
                    </label>
                    <label>
                      {t("v2.criteria")}
                      <textarea
                        value={d.criteria}
                        onChange={(e) =>
                          update(i, { criteria: e.target.value })
                        }
                      />
                    </label>
                    <button
                      className="secondary"
                      disabled={suggesting !== undefined || !d.title.trim()}
                      onClick={async () => {
                        setSuggesting(i);
                        setError(undefined);
                        try {
                          const result = await post<{ criteria: string[] }>(
                            "/criteria/suggest",
                            { outcome, deliverable: d.title, locale },
                          );
                          setSuggestions((old) => ({
                            ...old,
                            [i]: result.criteria,
                          }));
                        } catch {
                          setError(new Error(t("v2.aiUnavailable")));
                        } finally {
                          setSuggesting(undefined);
                        }
                      }}
                    >
                      {t("v2.suggestCriteria")}
                    </button>
                    {suggestions[i] && (
                      <section className="notice">
                        <p>{t("v2.suggestionReview")}</p>
                        <ul>
                          {suggestions[i].map((text) => (
                            <li key={text}>{text}</li>
                          ))}
                        </ul>
                        <button
                          className="secondary"
                          onClick={() => {
                            update(i, { criteria: suggestions[i].join("\n") });
                            setSuggestions((old) => {
                              const next = { ...old };
                              delete next[i];
                              return next;
                            });
                          }}
                        >
                          {t("v2.useSuggestions")}
                        </button>
                      </section>
                    )}
                    <label>
                      {t("v2.requiredEvidence")}
                      <select
                        aria-label={t("v2.requiredEvidence")}
                        value={d.type}
                        onChange={(e) => update(i, { type: e.target.value })}
                      >
                        {[
                          "JSON",
                          "TEXT",
                          "DEPLOYMENT_URL",
                          "PULL_REQUEST",
                          "GITHUB_REPOSITORY",
                          "FILE",
                          "IMAGE",
                          "API_ENDPOINT",
                          "TRANSACTION",
                          "OTHER_URL",
                        ].map((v) => (
                          <option key={v} value={v}>
                            {evidenceTypeLabel(v, t)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {deliveries.length > 1 && (
                      <button
                        className="secondary"
                        onClick={() =>
                          setDeliveries((items) =>
                            items.filter((_, n) => n !== i),
                          )
                        }
                      >
                        {t("v2.remove")}
                      </button>
                    )}
                  </section>
                ))}
                <button
                  className="secondary"
                  disabled={deliveries.length >= 32}
                  onClick={() =>
                    setDeliveries((ds) => [
                      ...ds,
                      {
                        title: "",
                        criteria: "",
                        type: "JSON",
                        amount: "1",
                        due: date(7 + ds.length),
                      },
                    ])
                  }
                >
                  {t("v2.addMilestone")}
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <h2>{t("v2.stepsVerification")}</h2>
                <label>
                  {t("v2.verifier")}
                  <select
                    aria-label={t("v2.verifier")}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="ClientOnly">{t("v2.manual")}</option>
                    <option value="AIOnly">{t("v2.automated")}</option>
                    <option value="Hybrid">{t("v2.hybrid")}</option>
                    <option disabled>
                      Oracle · {t("v2.adapterUnavailable")}
                    </option>
                    <option disabled>
                      Custom Verifier · {t("v2.adapterUnavailable")}
                    </option>
                  </select>
                </label>
                {method !== "ClientOnly" && (
                  <>
                    <label>
                      {t("verification.preset")}
                      <select
                        aria-label={t("verification.preset")}
                        value={preset}
                        onChange={(e) => setPreset(e.target.value)}
                      >
                        <option value="JSON">JSON</option>
                        <option value="WEBSITE">
                          {t("verification.website")}
                        </option>
                        <option value="GITHUB_CI">GitHub / CI</option>
                        <option
                          value="SEMANTIC"
                          disabled={!capabilities.data?.ai}
                        >
                          {t("v2.aiSemantic")}
                          {!capabilities.data?.ai
                            ? ` · ${t("v2.unavailable")}`
                            : ""}
                        </option>
                      </select>
                    </label>
                    {preset === "JSON" || preset === "SEMANTIC" ? (
                      <label>
                        {t("v2.checks")} · JSON Schema
                        <textarea
                          className="mono"
                          value={schema}
                          onChange={(e) => setSchema(e.target.value)}
                        />
                      </label>
                    ) : preset === "WEBSITE" ? (
                      <label>
                        {t("verification.expectedUrl")}
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </label>
                    ) : (
                      <>
                        <label>
                          {t("v2.githubRepo")}
                          <input
                            value={repo}
                            onChange={(e) => setRepo(e.target.value)}
                          />
                        </label>
                        <label>
                          {t("v2.githubChecks")}
                          <input
                            value={checks}
                            onChange={(e) => setChecks(e.target.value)}
                          />
                        </label>
                        <label>
                          {t("v2.githubApp")}
                          <input
                            type="number"
                            value={appId}
                            onChange={(e) => setAppId(e.target.value)}
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
                <p className="small">{t("v2.securityNote")}</p>
              </>
            )}
            {step === 3 && (
              <>
                <h2>{t("v2.stepsPayment")}</h2>
                <label>
                  {t("v2.workerAddress")}
                  <input
                    value={worker}
                    onChange={(e) => setWorker(e.target.value)}
                    className="mono"
                  />
                </label>
                <label>
                  {t("v2.arbitrator")}
                  <input
                    value={arb}
                    onChange={(e) => setArb(e.target.value)}
                    className="mono"
                  />
                </label>
                {deliveries.map((d, i) => (
                  <div className="form-grid" key={i}>
                    <label>
                      {d.title} · {t("v2.amount")}
                      <input
                        inputMode="decimal"
                        value={d.amount}
                        onChange={(e) => update(i, { amount: e.target.value })}
                      />
                    </label>
                    <label>
                      {t("v2.due")}
                      <input
                        type="datetime-local"
                        value={d.due}
                        onChange={(e) => update(i, { due: e.target.value })}
                      />
                    </label>
                  </div>
                ))}
                <div className="form-grid">
                  <label>
                    {t("v2.acceptBy")}
                    <input
                      type="datetime-local"
                      value={acceptBy}
                      onChange={(e) => setAcceptBy(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("v2.reviewPeriod")}
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("v2.revisionLimit")}
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={revisions}
                      onChange={(e) => setRevisions(e.target.value)}
                    />
                  </label>
                </div>
                <p className="notice">{t("v2.secureDesc")}</p>
              </>
            )}
            {step === 4 && (
              <>
                <h2>{title}</h2>
                <p>{outcome}</p>
                <div className="row">
                  <span>{t("v2.builder")}</span>
                  <strong className="mono small">{worker}</strong>
                </div>
                <div className="row">
                  <span>{t("v2.budget")}</span>
                  <strong>
                    {deliveries.reduce((n, d) => n + Number(d.amount), 0)} USDC
                  </strong>
                </div>
                <div className="row">
                  <span>{t("v2.verification")}</span>
                  <strong>
                    {t(
                      method === "ClientOnly"
                        ? "v2.manual"
                        : method === "Hybrid"
                          ? "v2.hybrid"
                          : "v2.automated",
                    )}
                  </strong>
                </div>
                <div className="row">
                  <span>{t("v2.revisionLimit")}</span>
                  <strong>{revisions}</strong>
                </div>
                {deliveries.map((d, i) => (
                  <section className="submission-card" key={i}>
                    <h3>
                      {d.title} · {d.amount} USDC
                    </h3>
                    <p className="preserve">{d.criteria}</p>
                    <p>{d.due}</p>
                  </section>
                ))}
                <p>{t("v2.termsFrozen")}</p>
                <p>{t("v2.privacy")}</p>
              </>
            )}
            <ErrorMessage error={error} />
            {error instanceof Error && (
              <p role="alert">
                {["V2_NOT_CONFIGURED", "VERIFIER_NOT_CONFIGURED"].includes(
                  error.message,
                )
                  ? t("v2.v2NotConfigured")
                  : error.message === t("v2.validation") ||
                      error.message === t("v2.insufficient")
                    ? error.message
                    : t(readableError(error).code)}
              </p>
            )}
            <div className="actions">
              {step > 0 && (
                <button
                  className="secondary"
                  disabled={flow.busy || !!escrow}
                  onClick={() => setStep((s) => s - 1)}
                >
                  {t("v2.back")}
                </button>
              )}
              {step < 4 ? (
                <button onClick={next}>{t("v2.next")}</button>
              ) : (
                <NetworkGuard>
                  <button
                    onClick={confirm}
                    disabled={flow.busy || sdk.addresses.version !== 2}
                  >
                    {t("v2.fundCreate")}
                  </button>
                </NetworkGuard>
              )}
            </div>
          </section>
        </>
      )}
      <TransactionTimeline steps={flow.steps} />
    </main>
  );
}
