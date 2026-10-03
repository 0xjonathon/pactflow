"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { isAddress, parseUnits, type Address } from "viem";
import {
  hashAgreement,
  dataUriForAgreement,
  type CanonicalValue,
} from "@pactflow/sdk";
import {
  hashVerificationPolicy,
  type VerificationPolicy,
} from "@pactflow/verifier/policy";
import { useI18n } from "../lib/i18n";
import {
  useData,
  post,
  useSession,
  SignInCard,
  ErrorMessage,
  type Job,
  type Proposal,
} from "../lib/product";
import { protocolSdk } from "../lib/protocol";
import { usePactWalletAdapter } from "../lib/wallet-adapter";
import { NetworkGuard } from "./WalletBar";
import {
  TransactionTimeline,
  useTransactionFlow,
  readableError,
} from "../features/transaction/useTransactionFlow";
export function CollaborationDraft({ id }: { id: string }) {
  const { t } = useI18n();
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
  const [done, setDone] = useState(false);
  const confirm = async () => {
    if (!data.data || !wallet || !address) return;
    setError(null);
    setTechnicalError("");
    const { job, proposal } = data.data;
    try {
      const sdk = protocolSdk();
      if (sdk.addresses.version !== 2) throw new Error("V2_NOT_CONFIGURED");
      const arbitrator = process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS;
      if (!arbitrator || !isAddress(arbitrator))
        throw new Error("INVALID_ADDRESSES");
      const now = Math.floor(Date.now() / 1000);
      const policy = job.policy as VerificationPolicy | null;
      let agreement: CanonicalValue = {
        version: 2,
        visibility: "PARTICIPANTS",
        outcome: job.description,
        title: job.title,
        description: job.description,
        client: address,
        worker: proposal.workerAddress,
        arbitrator,
        token: sdk.addresses.SettlementToken,
        totalBudget: parseUnits(job.budget, 6).toString(),
        clientBond: parseUnits(job.clientDeposit, 6).toString(),
        workerBond: parseUnits(job.workerDeposit, 6).toString(),
        acceptanceDeadline: String(now + 3600),
        reviewPeriod: "86400",
        maxRevisions: 2,
        verifier:
          process.env.NEXT_PUBLIC_VERIFIER_ADDRESS ||
          "0x0000000000000000000000000000000000000000",
        policy: policy as unknown as CanonicalValue,
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
          ...(policy
            ? { verificationPolicy: policy as unknown as CanonicalValue }
            : {}),
        })),
      };
      let current =
        (job.escrowAddress as Address | undefined) ??
        escrow ??
        (window.localStorage.getItem(
          `pactflow_job_escrow_${id}`,
        ) as Address | null);
      if (!current) {
        const created = await flow.run("transaction.createPact", (hooks) =>
          sdk.createPact(
            wallet,
            {
              protocolVersion: 2,
              agreementHash: hashAgreement(agreement),
              client: address,
              worker: proposal.workerAddress as Address,
              token: sdk.addresses.SettlementToken,
              arbitrator,
              totalBudget: parseUnits(job.budget, 6),
              clientBond: parseUnits(job.clientDeposit, 6),
              workerBond: parseUnits(job.workerDeposit, 6),
              acceptanceDeadline: BigInt(now + 3600),
              reviewPeriod: 86400n,
              milestones: job.milestones.map((m) => ({
                amount: parseUnits(m.amount, 6),
                dueAt: BigInt(Math.floor(Date.parse(m.dueAt) / 1000)),
                rulesHash: policy
                  ? hashVerificationPolicy(policy)
                  : hashAgreement(agreement),
                maxRevisions: 2,
                verifier: (process.env.NEXT_PUBLIC_VERIFIER_ADDRESS ||
                  "0x0000000000000000000000000000000000000000") as Address,
                mode:
                  job.verificationMode === "ClientOnly"
                    ? 0
                    : job.verificationMode === "AIOnly"
                      ? 1
                      : 2,
              })),
            },
            hooks,
          ),
        );
        current = created.escrowAddress;
        window.localStorage.setItem(`pactflow_job_escrow_${id}`, current);
        window.localStorage.setItem(
          `pactflow_agreement_${current.toLowerCase()}`,
          dataUriForAgreement(agreement),
        );
      }
      const saved = window.localStorage.getItem(
        `pactflow_agreement_${current.toLowerCase()}`,
      );
      if (saved?.startsWith("data:application/json"))
        agreement = JSON.parse(
          decodeURIComponent(saved.split(",").slice(1).join(",")),
        );
      setEscrow(current);
      await post(`/pacts/${current}/spec`, agreement);
      await post<Job>(`/jobs/${id}/pact`, { escrow: current });
      if (policy)
        for (let i = 0; i < job.milestones.length; i++)
          await post("/verification/policies", {
            escrow: current,
            milestoneIndex: i,
            policy,
          });
      const state = await sdk.getPact(current);
      if (state.status === "Created") {
        const required = state.totalBudget + state.clientBond;
        const allowance = await sdk.getAllowance(
          state.settlementToken,
          address,
          current,
        );
        if (allowance < required)
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
      const code = e instanceof Error ? e.message : "generic";
      if (code.includes("PACT") || code.includes("JOB")) setError(e);
      else setTechnicalError(t(readableError(e).code));
    }
  };
  return (
    <main className="shell narrow">
      <h1>{t("jobs.reviewDraft")}</h1>
      {!user ? (
        <SignInCard />
      ) : data.error ? (
        <ErrorMessage error={data.error} />
      ) : (
        data.data && (
          <section className="card">
            <h2>{data.data.job.title}</h2>
            <div className="row">
              <span>{t("pact.worker")}</span>
              <strong>
                {data.data.proposal.worker?.displayName ??
                  data.data.proposal.workerAddress.slice(0, 8)}
              </strong>
            </div>
            <div className="row">
              <span>{t("marketplace.budget")}</span>
              <strong>{data.data.job.budget} USDC</strong>
            </div>
            <p>{t("jobs.fundHelp")}</p>
            {done && escrow ? (
              <Link className="button" href={`/pacts/${escrow}`}>
                {t("jobs.openWorkspace")}
              </Link>
            ) : (
              <NetworkGuard>
                <button disabled={flow.busy} onClick={confirm}>
                  {t("jobs.createCollaboration")}
                </button>
              </NetworkGuard>
            )}
            <ErrorMessage error={error} />
            {technicalError && <p role="alert">{technicalError}</p>}
          </section>
        )
      )}
      <TransactionTimeline steps={flow.steps} />
    </main>
  );
}
