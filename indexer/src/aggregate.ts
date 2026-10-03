import type { PactView } from "@pactflow/sdk";
export type IndexedEvent = {
  id: string;
  chainId: number;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockHash: string;
  address: string;
  name: string;
  args: Record<string, unknown>;
  timestamp: Date;
};
export type ReputationMetrics = {
  completedPacts: number;
  verificationRuns: number;
  passedVerifications: number;
  submissionCount: number;
  revisionCount: number;
  passRate: number | null;
  revisionRate: number | null;
  settledVolume: string;
  successfulMilestones: number;
  aiVerified: number;
  humanVerified: number;
  disputes: number;
  disputesLost: number | null;
  onTimeRate: number | null;
  repeatCounterpartyRate: number | null;
  disputeRate: number | null;
  repeatCounterparties: number;
};
export function eventId(
  event: Pick<IndexedEvent, "chainId" | "txHash" | "logIndex">,
) {
  return `${event.chainId}:${event.txHash.toLowerCase()}:${event.logIndex}`;
}
export function aggregateReputation(pacts: PactView[], input: IndexedEvent[]) {
  const events = [...new Map(input.map((e) => [eventId(e), e])).values()];
  const facts = new Map<string, ReputationMetrics>();
  const times = new Map<string, { onTime: number; total: number }>();
  const relationships = new Map<
    string,
    {
      id: string;
      actorA: string;
      actorB: string;
      completedPacts: number;
      settledVolume: string;
      disputes: number;
      lastCollaborationAt: Date;
    }
  >();
  const get = (a: string) => {
    a = a.toLowerCase();
    let v = facts.get(a);
    if (!v) {
      v = {
        completedPacts: 0,
        verificationRuns: 0,
        passedVerifications: 0,
        submissionCount: 0,
        revisionCount: 0,
        passRate: null,
        revisionRate: null,
        settledVolume: "0",
        successfulMilestones: 0,
        aiVerified: 0,
        humanVerified: 0,
        disputes: 0,
        disputesLost: 0,
        onTimeRate: null,
        repeatCounterpartyRate: null,
        disputeRate: null,
        repeatCounterparties: 0,
      };
      facts.set(a, v);
    }
    return v;
  };
  for (const pact of pacts) {
    const client = pact.client.toLowerCase();
    const worker = (pact.worker ?? pact.fixedWorker)?.toLowerCase();
    get(client);
    if (!worker) continue;
    get(worker);
    const related = events.filter(
      (e) =>
        e.address === pact.escrowAddress.toLowerCase() ||
        e.args.pact === pact.escrowAddress.toLowerCase(),
    );
    const submitted = related.filter((e) => e.name === "Submitted");
    const revised = related.filter((e) => e.name === "RevisionRequested");
    // A hybrid approval and its automated attestation belong to the same submission.
    const verdicts = new Map<string, boolean>();
    for (const event of related.filter((e) =>
      [
        "VerificationRecorded",
        "ClientApprovalRecorded",
        "RevisionRequested",
      ].includes(e.name),
    )) {
      const key = `${event.args.id}:${event.args.submissionId}`;
      const passed =
        event.name === "ClientApprovalRecorded" ||
        (event.name === "VerificationRecorded" && event.args.approved === true);
      verdicts.set(
        key,
        verdicts.has(key) ? verdicts.get(key)! && passed : passed,
      );
    }
    for (const actor of [client, worker]) {
      const v = get(actor);
      v.submissionCount += submitted.length;
      v.revisionCount += revised.length;
      v.verificationRuns += verdicts.size;
      v.passedVerifications += [...verdicts.values()].filter(Boolean).length;
    }
    const completed = related.filter((e) => e.name === "Completed");
    const actors = [client, worker].sort();
    const key = actors.join(":");
    let relation = relationships.get(key);
    if (!relation) {
      relation = {
        id: key,
        actorA: actors[0],
        actorB: actors[1],
        completedPacts: 0,
        settledVolume: "0",
        disputes: 0,
        lastCollaborationAt: new Date(0),
      };
      relationships.set(key, relation);
    }
    if (completed.length) {
      get(client).completedPacts++;
      get(worker).completedPacts++;
      relation.completedPacts++;
    }
    for (const e of related) {
      if (e.timestamp > relation.lastCollaborationAt)
        relation.lastCollaborationAt = e.timestamp;
      if (e.name === "Submitted") {
        const m = pact.milestones[Number(e.args.id)];
        const settled = related.some(
          (s) =>
            s.name === "MilestoneSettled" &&
            Number(s.args.id) === Number(e.args.id),
        );
        const latest = related
          .filter(
            (s) =>
              s.name === "Submitted" && Number(s.args.id) === Number(e.args.id),
          )
          .sort(
            (a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex,
          )[0];
        if (m && settled && e === latest) {
          const v = times.get(worker) ?? { onTime: 0, total: 0 };
          v.total++;
          if (Math.floor(+e.timestamp / 1000) <= Number(m.dueAt)) v.onTime++;
          times.set(worker, v);
        }
      }
      if (e.name === "DisputeOpened") {
        get(client).disputes++;
        get(worker).disputes++;
        relation.disputes++;
      }
      if (e.name === "MilestoneSettled") {
        const m = pact.milestones[Number(e.args.id)];
        const award = BigInt(String(e.args.workerAward));
        get(worker).settledVolume = (
          BigInt(get(worker).settledVolume) + award
        ).toString();
        get(client).settledVolume = (
          BigInt(get(client).settledVolume) + award
        ).toString();
        relation.settledVolume = (
          BigInt(relation.settledVolume) + award
        ).toString();
        if (award > 0n) {
          get(worker).successfulMilestones++;
          get(client).successfulMilestones++;
        }
        if (m) {
          if (m.aiAttested) {
            get(worker).aiVerified++;
            get(client).aiVerified++;
          }
          if (
            m.mode === "ClientOnly" ||
            m.mode === "Hybrid" ||
            m.mode === "Arbitrator"
          ) {
            get(worker).humanVerified++;
            get(client).humanVerified++;
          }
          if (
            related.some(
              (x) =>
                x.name === "DisputeOpened" &&
                Number(x.args.id) === Number(e.args.id),
            )
          ) {
            if (award < m.amount) get(worker).disputesLost!++;
            if (award === m.amount) get(client).disputesLost!++;
          }
        }
      }
    }
  }
  for (const [address, metrics] of facts) {
    if (metrics.verificationRuns)
      metrics.passRate = Math.round(
        (metrics.passedVerifications / metrics.verificationRuns) * 100,
      );
    const relevant = pacts.filter((p) =>
      [p.client, p.worker ?? p.fixedWorker].some(
        (a) => a?.toLowerCase() === address,
      ),
    );
    const allSubmitted = new Set(
      events
        .filter(
          (e) =>
            e.name === "Submitted" &&
            relevant.some((p) => p.escrowAddress.toLowerCase() === e.address),
        )
        .map((e) => `${e.address}:${e.args.id}`),
    );
    const allRevised = new Set(
      events
        .filter(
          (e) =>
            e.name === "RevisionRequested" &&
            relevant.some((p) => p.escrowAddress.toLowerCase() === e.address),
        )
        .map((e) => `${e.address}:${e.args.id}`),
    );
    if (allSubmitted.size)
      metrics.revisionRate = Math.round(
        (allRevised.size / allSubmitted.size) * 100,
      );
    const time = times.get(address);
    if (time?.total)
      metrics.onTimeRate = Math.round((time.onTime / time.total) * 100);
    const relations = [...relationships.values()].filter(
      (r) =>
        (r.actorA === address || r.actorB === address) && r.completedPacts > 0,
    );
    metrics.repeatCounterparties = relations.filter(
      (r) => r.completedPacts > 1,
    ).length;
    const assigned = pacts.filter(
      (p) =>
        p.client.toLowerCase() === address ||
        (p.worker ?? p.fixedWorker)?.toLowerCase() === address,
    );
    if (assigned.length)
      metrics.disputeRate = Math.round(
        (assigned.filter((p) =>
          events.some(
            (e) =>
              e.address === p.escrowAddress.toLowerCase() &&
              e.name === "DisputeOpened",
          ),
        ).length /
          assigned.length) *
          100,
      );
    if (relations.length)
      metrics.repeatCounterpartyRate = Math.round(
        (relations.filter((r) => r.completedPacts > 1).length /
          relations.length) *
          100,
      );
  }
  return { facts, relationships: [...relationships.values()] };
}
