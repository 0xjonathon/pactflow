import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { isAddress, verifyMessage, parseUnits, type Address } from "viem";
import type { PactFlowDatabase } from "@pactflow/db/client";
import * as s from "@pactflow/db";
import type { PactFlowSdk } from "@pactflow/sdk";
import {
  hashVerificationPolicy,
  verificationPolicySchema,
} from "@pactflow/verifier/policy";

export class ProductError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(code);
  }
}
const fail = (status: number, code: string): never => {
  throw new ProductError(status, code);
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const addr = z
  .string()
  .refine(isAddress)
  .transform((v) => v.toLowerCase() as Address);
const amount = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/)
  .refine((v) => Number(v) >= 0 && Number(v) <= 1_000_000);
const milestone = z.object({
  title: z.string().min(1).max(160),
  amount,
  dueAt: z.iso.datetime(),
});
export const jobSchema = z
  .object({
    title: z.string().min(5).max(160),
    description: z.string().min(20).max(12000),
    requirements: z.string().max(8000).default(""),
    category: z.enum(["Development", "Design", "Research", "Data", "Content"]),
    skills: z.array(z.string().min(1).max(40)).max(12),
    budget: amount.refine((v) => Number(v) > 0),
    deadline: z.iso.datetime(),
    milestones: z.array(milestone).min(1).max(32),
    verificationMode: z.enum(["ClientOnly", "AIOnly", "Hybrid"]),
    policy: verificationPolicySchema.nullable().default(null),
    clientDeposit: amount,
    workerDeposit: z.literal("0").default("0"),
  })
  .superRefine((v, ctx) => {
    if (
      v.milestones.every((m) => amount.safeParse(m.amount).success) &&
      amount.safeParse(v.budget).success &&
      v.milestones.reduce((a, m) => a + parseUnits(m.amount, 6), 0n) !==
        parseUnits(v.budget, 6)
    )
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message: "form.milestoneTotal",
      });
    if (
      Date.parse(v.deadline) <= Date.now() ||
      v.milestones.some(
        (m, i) =>
          Date.parse(m.dueAt) > Date.parse(v.deadline) ||
          Date.parse(m.dueAt) <=
            (i ? Date.parse(v.milestones[i - 1].dueAt) : Date.now() + 3600_000),
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message: "form.orderedDeadlines",
      });
    if (
      v.verificationMode !== "ClientOnly" &&
      (!v.policy ||
        v.policy.mode !==
          (v.verificationMode === "Hybrid" ? "HYBRID" : "AI_ONLY"))
    )
      ctx.addIssue({
        code: "custom",
        path: ["policy"],
        message: "form.policyMismatch",
      });
  });
const profileSchema = z.object({
  displayName: z.string().min(2).max(60),
  handle: z.string().regex(/^[a-z0-9][a-z0-9-]{2,30}$/),
  role: z.string().max(100),
  bio: z.string().max(2000),
  skills: z.array(z.string().max(40)).max(12),
  category: z.enum(["Development", "Design", "Research", "Data", "Content"]),
  intent: z.enum(["HIRE", "WORK", "BOTH"]),
});
export async function registerProductRoutes(
  app: FastifyInstance,
  db: PactFlowDatabase,
  sdk: PactFlowSdk,
) {
  // Sample listings follow the current product policy; real agreements retain their terms.
  await db
    .update(s.jobs)
    .set({ workerDeposit: "0" })
    .where(and(eq(s.jobs.demo, true), sql`${s.jobs.escrowAddress} is null`));
  async function actor(request: FastifyRequest) {
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    if (!token) return fail(401, "SIGN_IN_REQUIRED");
    const [session] = await db
      .select()
      .from(s.sessions)
      .where(
        and(
          eq(s.sessions.tokenHash, hash(token)),
          gt(s.sessions.expiresAt, new Date()),
        ),
      );
    if (!session) return fail(401, "SESSION_EXPIRED");
    return session;
  }
  async function profile(id: string) {
    const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
    const [wallet] = await db
      .select()
      .from(s.wallets)
      .where(eq(s.wallets.userId, id));
    const [rep] = wallet
      ? await db
          .select()
          .from(s.reputationSnapshots)
          .where(eq(s.reputationSnapshots.address, wallet.address))
      : [];
    return {
      ...user,
      wallet: wallet?.address,
      reputation: rep?.metrics ?? null,
    };
  }
  async function job(id: string) {
    const [value] = await db.select().from(s.jobs).where(eq(s.jobs.id, id));
    if (!value) return fail(404, "NOT_FOUND");
    const [pact] = value.escrowAddress
      ? await db
          .select()
          .from(s.pacts)
          .where(eq(s.pacts.address, value.escrowAddress))
      : [];
    const [selected] = await db
      .select()
      .from(s.proposals)
      .where(
        and(eq(s.proposals.jobId, id), eq(s.proposals.status, "ACCEPTED")),
      );
    const snapshot = pact?.snapshot as
      | { fundedBudget?: string; status?: string }
      | undefined;
    return {
      ...value,
      client: await profile(value.clientId),
      worker: selected ? await profile(selected.workerId) : null,
      fundsLocked:
        !!snapshot &&
        BigInt(snapshot.fundedBudget ?? "0") > 0n &&
        !["Completed", "Cancelled"].includes(snapshot.status ?? ""),
      pactStatus: snapshot?.status,
    };
  }
  async function notify(
    userId: string,
    type: string,
    href: string,
    title: string,
    id: string = randomUUID(),
  ) {
    await db
      .insert(s.notifications)
      .values({ id, userId, type, href, title })
      .onConflictDoNothing();
  }
  async function track(
    userId: string,
    event: string,
    properties: Record<string, unknown> = {},
  ) {
    await db.insert(s.analytics).values({ userId, event, properties });
  }

  app.post("/api/v1/auth/challenge", async (request) => {
    const { address } = z.object({ address: addr }).parse(request.body);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const message = `PactFlow settlement account sign-in\nOrigin: ${process.env.WEB_ORIGIN ?? "http://localhost:3001"}\nWallet: ${address}\nNonce: ${id}\nExpires: ${expiresAt.toISOString()}\nThis signature confirms account ownership. It does not move funds.`;
    await db
      .insert(s.authChallenges)
      .values({ id, address, message, expiresAt });
    return { id, message };
  });
  app.post("/api/v1/auth/verify", async (request) => {
    const { id, signature } = z
      .object({ id: z.uuid(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) })
      .parse(request.body);
    const [challenge] = await db
      .select()
      .from(s.authChallenges)
      .where(eq(s.authChallenges.id, id));
    if (
      !challenge ||
      challenge.used ||
      challenge.expiresAt < new Date() ||
      !(await verifyMessage({
        address: challenge.address as Address,
        message: challenge.message,
        signature: signature as `0x${string}`,
      }))
    )
      return fail(401, "INVALID_SIGNATURE");
    const token = randomBytes(32).toString("hex");
    const result = await db.transaction(async (tx) => {
      const consumed = await tx
        .update(s.authChallenges)
        .set({ used: true })
        .where(
          and(eq(s.authChallenges.id, id), eq(s.authChallenges.used, false)),
        )
        .returning();
      if (!consumed.length) return fail(409, "CHALLENGE_USED");
      const [wallet] = await tx
        .select()
        .from(s.wallets)
        .where(eq(s.wallets.address, challenge.address));
      let userId = wallet?.userId;
      if (!userId) {
        const [user] = await tx
          .insert(s.users)
          .values({
            handle: `member-${randomBytes(5).toString("hex")}`,
            displayName: "New member",
          })
          .returning();
        userId = user.id;
        await tx
          .insert(s.wallets)
          .values({ address: challenge.address, userId });
      }
      await tx.insert(s.sessions).values({
        tokenHash: hash(token),
        userId,
        address: challenge.address,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      });
      return userId;
    });
    return { token, user: await profile(result) };
  });
  app.get("/api/v1/me", async (request) =>
    profile((await actor(request)).userId),
  );
  app.patch("/api/v1/me/profile", async (request) => {
    const session = await actor(request);
    const input = profileSchema.parse(request.body);
    await db.update(s.users).set(input).where(eq(s.users.id, session.userId));
    return profile(session.userId);
  });
  app.get("/api/v1/users/:handle", async (request) => {
    const { handle } = z.object({ handle: z.string() }).parse(request.params);
    const [user] = await db
      .select()
      .from(s.users)
      .where(eq(s.users.handle, handle));
    if (!user) return fail(404, "NOT_FOUND");
    return profile(user.id);
  });
  app.get("/api/v1/talent", async (request) => {
    const q = z
      .object({
        search: z.string().default(""),
        skill: z.string().default(""),
        category: z.string().default(""),
        minCompleted: z.coerce.number().min(0).default(0),
        page: z.coerce.number().int().min(1).default(1),
      })
      .parse(request.query);
    const values = await db
      .select()
      .from(s.users)
      .where(
        sql`${s.users.intent} IN ('WORK','BOTH') AND (${q.search} = '' OR ${s.users.displayName} ILIKE ${`%${q.search}%`} OR ${s.users.role} ILIKE ${`%${q.search}%`}) AND (${q.category} = '' OR ${s.users.category} = ${q.category})`,
      )
      .orderBy(desc(s.users.createdAt));
    const enriched = await Promise.all(values.map((v) => profile(v.id)));
    const items = enriched.filter(
      (v) =>
        (!q.skill ||
          v.skills?.some((x) =>
            x.toLowerCase().includes(q.skill.toLowerCase()),
          )) &&
        Number(
          (v.reputation as { completedPacts?: number })?.completedPacts ?? 0,
        ) >= q.minCompleted,
    );
    return {
      items: items.slice((q.page - 1) * 12, q.page * 12),
      total: items.length,
      page: q.page,
    };
  });
  app.get("/api/v1/users/:handle/reputation", async (request) => {
    const { handle } = request.params as { handle: string };
    const [user] = await db
      .select()
      .from(s.users)
      .where(eq(s.users.handle, handle));
    if (!user) return fail(404, "NOT_FOUND");
    const person = await profile(user.id);
    const relations = person.wallet
      ? await db
          .select()
          .from(s.actorRelationships)
          .where(
            sql`${s.actorRelationships.actorA} = ${person.wallet} OR ${s.actorRelationships.actorB} = ${person.wallet}`,
          )
      : [];
    return {
      metrics: person.reputation,
      counterparties: relations,
      source: "Monad Testnet indexed events",
    };
  });
  app.get("/api/v1/users/:handle/history", async (request) => {
    const { handle } = request.params as { handle: string };
    const [user] = await db
      .select()
      .from(s.users)
      .where(eq(s.users.handle, handle));
    if (!user) return fail(404, "NOT_FOUND");
    const person = await profile(user.id);
    if (!person.wallet) return { pacts: [], events: [] };
    const history = await db
      .select()
      .from(s.pacts)
      .where(
        sql`${s.pacts.client} = ${person.wallet} OR ${s.pacts.worker} = ${person.wallet}`,
      );
    const addresses = history.map((p) => p.address);
    const events = addresses.length
      ? await db
          .select()
          .from(s.reputationEvents)
          .where(
            sql`${s.reputationEvents.address} IN (${sql.join(
              addresses.map((a) => sql`${a}`),
              sql`,`,
            )})`,
          )
          .orderBy(
            desc(s.reputationEvents.blockNumber),
            desc(s.reputationEvents.logIndex),
          )
      : [];
    const receipts = addresses.length
      ? await db
          .select({
            escrow: s.publicDisclosures.escrowAddress,
            publicId: s.publicDisclosures.publicId,
            payload: s.publicDisclosures.payload,
          })
          .from(s.publicDisclosures)
          .where(
            and(
              eq(s.publicDisclosures.clientApproved, true),
              eq(s.publicDisclosures.workerApproved, true),
              sql`${s.publicDisclosures.escrowAddress} IN (${sql.join(
                addresses.map((a) => sql`${a}`),
                sql`,`,
              )})`,
            ),
          )
      : [];
    return { pacts: history, events, receipts };
  });
  app.post("/api/v1/jobs", async (request) => {
    const a = await actor(request);
    const input = jobSchema.parse(request.body);
    const [value] = await db
      .insert(s.jobs)
      .values({
        ...input,
        deadline: new Date(input.deadline),
        clientId: a.userId,
      })
      .returning();
    await track(a.userId, "job_created", { jobId: value.id });
    return job(value.id);
  });
  app.get("/api/v1/jobs", async (request) => {
    const q = z
      .object({
        search: z.string().default(""),
        category: z.string().default(""),
        verification: z.string().default(""),
        minBudget: z.coerce.number().min(0).default(0),
        maxBudget: z.coerce.number().min(0).default(1000000),
        deadline: z.string().default(""),
        funding: z.string().default(""),
        sort: z
          .enum(["newest", "budget-high", "budget-low", "deadline"])
          .default("newest"),
        page: z.coerce.number().int().min(1).default(1),
      })
      .parse(request.query);
    const rows = await db
      .select()
      .from(s.jobs)
      .where(
        sql`${s.jobs.status} IN ('OPEN','MATCHED') AND (${q.search} = '' OR ${s.jobs.title} ILIKE ${`%${q.search}%`} OR ${s.jobs.description} ILIKE ${`%${q.search}%`} OR ${s.jobs.skills}::text ILIKE ${`%${q.search}%`}) AND (${q.category} = '' OR ${s.jobs.category} = ${q.category}) AND (${q.verification} = '' OR ${s.jobs.verificationMode} = ${q.verification}) AND ${s.jobs.budget}::numeric BETWEEN ${q.minBudget} AND ${q.maxBudget}`,
      )
      .orderBy(desc(s.jobs.createdAt));
    let enriched = await Promise.all(rows.map((v) => job(v.id)));
    enriched = enriched.filter(
      (v) =>
        (!q.deadline || v.deadline <= new Date(q.deadline)) &&
        (!q.funding || v.fundsLocked === (q.funding === "locked")),
    );
    if (q.sort !== "newest")
      enriched.sort((a, b) =>
        q.sort === "deadline"
          ? +a.deadline - +b.deadline
          : (Number(a.budget) - Number(b.budget)) *
            (q.sort === "budget-high" ? -1 : 1),
      );
    return {
      items: enriched.slice((q.page - 1) * 9, q.page * 9),
      total: enriched.length,
      page: q.page,
    };
  });
  app.get("/api/v1/jobs/:id", async (request) =>
    job(z.object({ id: z.uuid() }).parse(request.params).id),
  );
  app.patch("/api/v1/jobs/:id", async (request) => {
    const a = await actor(request);
    const value = await job((request.params as { id: string }).id);
    if (value.clientId !== a.userId || value.status !== "DRAFT")
      return fail(403, "JOB_NOT_EDITABLE");
    const input = jobSchema.parse(request.body);
    await db
      .update(s.jobs)
      .set({
        ...input,
        deadline: new Date(input.deadline),
        updatedAt: new Date(),
      })
      .where(eq(s.jobs.id, value.id));
    return job(value.id);
  });
  for (const [action, status] of [
    ["publish", "OPEN"],
    ["close", "CLOSED"],
  ] as const)
    app.post(`/api/v1/jobs/:id/${action}`, async (request) => {
      const a = await actor(request);
      const value = await job((request.params as { id: string }).id);
      if (
        value.clientId !== a.userId ||
        (action === "publish"
          ? value.status !== "DRAFT"
          : !["OPEN", "MATCHED"].includes(value.status))
      )
        return fail(409, "INVALID_JOB_STATE");
      await db
        .update(s.jobs)
        .set({ status, updatedAt: new Date() })
        .where(eq(s.jobs.id, value.id));
      if (action === "publish")
        await track(a.userId, "job_published", { jobId: value.id });
      return job(value.id);
    });
  app.post("/api/v1/jobs/:id/proposals", async (request) => {
    const a = await actor(request);
    const value = await job((request.params as { id: string }).id);
    if (value.clientId === a.userId) return fail(403, "CANNOT_APPLY_OWN_JOB");
    if (value.status !== "OPEN" || value.deadline < new Date())
      return fail(409, "JOB_NOT_OPEN");
    const input = z
      .object({
        message: z.string().min(20).max(5000),
        estimatedDays: z.number().int().min(1).max(365),
        acceptBudget: z.literal(true),
        milestones: z.array(milestone).optional(),
      })
      .parse(request.body);
    if (input.milestones)
      jobSchema.parse({
        ...value,
        deadline: value.deadline.toISOString(),
        workerDeposit: "0",
        milestones: input.milestones,
      });
    if (
      input.milestones &&
      input.milestones.reduce((a, m) => a + parseUnits(m.amount, 6), 0n) !==
        parseUnits(value.budget, 6)
    )
      return fail(400, "INVALID_MILESTONE_TOTAL");
    const [proposal] = await db
      .insert(s.proposals)
      .values({
        ...input,
        jobId: value.id,
        workerId: a.userId,
        workerAddress: a.address,
      })
      .returning();
    await notify(
      value.clientId,
      "proposal_received",
      `/jobs/${value.id}`,
      value.title,
    );
    await track(a.userId, "proposal_created", { jobId: value.id });
    return proposal;
  });
  app.post("/api/v1/jobs/:id/invite", async (request) => {
    const a = await actor(request);
    const value = await job((request.params as { id: string }).id);
    if (value.clientId !== a.userId || value.status !== "OPEN")
      return fail(403, "JOB_NOT_EDITABLE");
    const { handle } = z
      .object({ handle: z.string().regex(/^[a-z0-9][a-z0-9-]{2,30}$/) })
      .parse(request.body);
    const [target] = await db
      .select()
      .from(s.users)
      .where(eq(s.users.handle, handle));
    if (!target || target.id === a.userId) return fail(400, "INVALID_INPUT");
    await notify(
      target.id,
      "job_invitation",
      `/jobs/${value.id}`,
      value.title,
      `invite:${value.id}:${target.id}`,
    );
    return { ok: true };
  });
  app.get("/api/v1/jobs/:id/proposals", async (request) => {
    const a = await actor(request);
    const value = await job((request.params as { id: string }).id);
    const rows = await db
      .select()
      .from(s.proposals)
      .where(
        value.clientId === a.userId
          ? eq(s.proposals.jobId, value.id)
          : and(
              eq(s.proposals.jobId, value.id),
              eq(s.proposals.workerId, a.userId),
            ),
      );
    return Promise.all(
      rows.map(async (p) => ({ ...p, worker: await profile(p.workerId) })),
    );
  });
  app.post("/api/v1/proposals/:id/accept", async (request) => {
    const a = await actor(request);
    const id = z.uuid().parse((request.params as { id: string }).id);
    const value = await db.transaction(async (tx) => {
      const [proposal] = await tx
        .select()
        .from(s.proposals)
        .where(eq(s.proposals.id, id));
      if (!proposal) return fail(404, "NOT_FOUND");
      const changed = await tx
        .update(s.jobs)
        .set({
          status: "MATCHED",
          ...(proposal.milestones
            ? { milestones: proposal.milestones as s.JobMilestone[] }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(s.jobs.id, proposal.jobId),
            eq(s.jobs.clientId, a.userId),
            eq(s.jobs.status, "OPEN"),
          ),
        )
        .returning();
      if (!changed.length || proposal.status !== "PENDING")
        return fail(409, "ALREADY_MATCHED");
      await tx
        .update(s.proposals)
        .set({ status: "REJECTED" })
        .where(
          and(
            eq(s.proposals.jobId, proposal.jobId),
            eq(s.proposals.status, "PENDING"),
          ),
        );
      await tx
        .update(s.proposals)
        .set({ status: "ACCEPTED" })
        .where(eq(s.proposals.id, id));
      return proposal;
    });
    await notify(
      value.workerId,
      "proposal_accepted",
      `/jobs/${value.jobId}`,
      (await job(value.jobId)).title,
    );
    await track(a.userId, "proposal_accepted", { jobId: value.jobId });
    return {
      job: await job(value.jobId),
      proposal: { ...value, status: "ACCEPTED" },
    };
  });
  app.post("/api/v1/proposals/:id/withdraw", async (request) => {
    const a = await actor(request);
    const rows = await db
      .update(s.proposals)
      .set({ status: "WITHDRAWN" })
      .where(
        and(
          eq(s.proposals.id, (request.params as { id: string }).id),
          eq(s.proposals.workerId, a.userId),
          eq(s.proposals.status, "PENDING"),
        ),
      )
      .returning();
    if (!rows.length) return fail(409, "INVALID_PROPOSAL_STATE");
    return rows[0];
  });
  app.get("/api/v1/jobs/:id/pact-draft", async (request) => {
    const a = await actor(request);
    const value = await job((request.params as { id: string }).id);
    if (value.clientId !== a.userId || value.status !== "MATCHED")
      return fail(403, "NO_MATCHED_PROPOSAL");
    const [proposal] = await db
      .select()
      .from(s.proposals)
      .where(
        and(
          eq(s.proposals.jobId, value.id),
          eq(s.proposals.status, "ACCEPTED"),
        ),
      );
    return {
      job: value,
      proposal: { ...proposal, worker: await profile(proposal.workerId) },
      clientAddress: a.address,
    };
  });
  app.post("/api/v1/jobs/:id/pact", async (request) => {
    const a = await actor(request);
    const value = await job((request.params as { id: string }).id);
    const input = z.object({ escrow: addr }).parse(request.body);
    if (value.clientId !== a.userId || value.status !== "MATCHED")
      return fail(409, "INVALID_JOB_STATE");
    if (value.escrowAddress) {
      if (value.escrowAddress === input.escrow) return job(value.id);
      return fail(409, "INVALID_JOB_STATE");
    }
    const [proposal] = await db
      .select()
      .from(s.proposals)
      .where(
        and(
          eq(s.proposals.jobId, value.id),
          eq(s.proposals.status, "ACCEPTED"),
        ),
      );
    const pact = await sdk.getPact(input.escrow);
    if (
      !proposal ||
      pact.client.toLowerCase() !== a.address ||
      pact.fixedWorker?.toLowerCase() !== proposal.workerAddress ||
      pact.settlementToken.toLowerCase() !==
        sdk.addresses.SettlementToken.toLowerCase() ||
      pact.totalBudget !== parseUnits(value.budget, 6) ||
      pact.clientBond !== parseUnits(value.clientDeposit, 6) ||
      pact.workerBond !== parseUnits(value.workerDeposit, 6) ||
      pact.milestones.length !== value.milestones.length ||
      pact.milestones.some(
        (m, i) =>
          m.amount !== parseUnits(value.milestones[i].amount, 6) ||
          m.dueAt !==
            BigInt(Math.floor(Date.parse(value.milestones[i].dueAt) / 1000)) ||
          m.mode !== value.verificationMode ||
          (value.policy &&
            m.rulesHash !== hashVerificationPolicy(value.policy)),
      )
    )
      return fail(409, "PACT_DRAFT_MISMATCH");
    await db
      .update(s.jobs)
      .set({ escrowAddress: input.escrow })
      .where(eq(s.jobs.id, value.id));
    await track(a.userId, "pact_created", { escrow: input.escrow });
    return job(value.id);
  });
  app.get("/api/v1/pacts/:escrow/project", async (request) => {
    const { escrow } = z.object({ escrow: addr }).parse(request.params);
    const [value] = await db
      .select()
      .from(s.jobs)
      .where(eq(s.jobs.escrowAddress, escrow));
    return value ? job(value.id) : null;
  });
  app.get("/api/v1/me/work", async (request) => {
    const a = await actor(request);
    const owned = await db
      .select()
      .from(s.jobs)
      .where(eq(s.jobs.clientId, a.userId));
    const applied = await db
      .select()
      .from(s.proposals)
      .where(eq(s.proposals.workerId, a.userId));
    const workerJobs = await Promise.all(applied.map((p) => job(p.jobId)));
    const history = await db
      .select()
      .from(s.pacts)
      .where(
        sql`${s.pacts.client} = ${a.address} OR ${s.pacts.worker} = ${a.address}`,
      );
    return {
      client: await Promise.all(owned.map((v) => job(v.id))),
      worker: workerJobs,
      proposals: applied,
      pacts: history,
    };
  });
  app.get("/api/v1/notifications", async (request) =>
    db
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, (await actor(request)).userId))
      .orderBy(desc(s.notifications.createdAt))
      .limit(100),
  );
  app.patch("/api/v1/notifications/:id", async (request) => {
    const a = await actor(request);
    await db
      .update(s.notifications)
      .set({ read: true })
      .where(
        and(
          eq(s.notifications.id, (request.params as { id: string }).id),
          eq(s.notifications.userId, a.userId),
        ),
      );
    return { ok: true };
  });
  app.get("/api/v1/stats", async () => {
    const events = await db.select().from(s.reputationEvents);
    return {
      pactsCreated: events.filter((e) => e.name === "PactCreated").length,
      onchainEvents: events.length,
      participants: new Set(
        events
          .filter((e) => e.name === "PactCreated")
          .flatMap((e) =>
            [e.args as { client: string; worker: string }]
              .flatMap((a) => [a.client, a.worker])
              .filter((a) => a && !/^0x0{40}$/.test(a)),
          ),
      ).size,
      completedPacts: events.filter((e) => e.name === "Completed").length,
      settledVolume: events
        .filter((e) => e.name === "MilestoneSettled")
        .reduce(
          (a, e) =>
            a + BigInt((e.args as { workerAward?: string }).workerAward ?? "0"),
          0n,
        )
        .toString(),
      aiVerifications: events.filter((e) => e.name === "AttestationConsumed")
        .length,
      source:
        process.env.PACTFLOW_LOCAL_CHAIN === "true"
          ? "LOCAL_TEST_ONLY"
          : "Monad Testnet",
      indexedAt:
        (await db.select().from(s.indexerCursors))[0]?.updatedAt ?? null,
    };
  });
  app.post("/api/v1/analytics", async (request) => {
    const input = z
      .object({
        event: z.enum([
          "landing_view",
          "onboarding_started",
          "wallet_connected",
          "job_created",
          "job_published",
          "proposal_created",
          "proposal_accepted",
          "pact_created",
          "pact_funded",
          "milestone_submitted",
          "verification_completed",
          "settlement_completed",
        ]),
        properties: z
          .record(
            z.string(),
            z.union([z.string().max(200), z.number(), z.boolean()]),
          )
          .default({}),
      })
      .parse(request.body);
    await db.insert(s.analytics).values(input);
    return { ok: true };
  });
  return { actor, profile, job };
}
