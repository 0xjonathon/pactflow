import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  uuid,
  jsonb,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

export const pacts = pgTable("pacts", {
  address: text("address").primaryKey(),
  chainId: integer("chain_id").notNull(),
  client: text("client").notNull(),
  worker: text("worker"),
  completed: boolean("completed").notNull().default(false),
  snapshot: jsonb("snapshot"),
  creationBlock: bigint("creation_block", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verificationPolicies = pgTable(
  "verification_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pactId: text("pact_id").notNull(),
    escrowAddress: text("escrow_address").notNull(),
    milestoneIndex: integer("milestone_index").notNull(),
    version: integer("version").notNull(),
    policy: jsonb("policy").notNull(),
    rulesHash: text("rules_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("verification_policies_escrow_milestone_hash_unique").on(
      table.escrowAddress,
      table.milestoneIndex,
      table.rulesHash,
    ),
  ],
);

export const verificationJobs = pgTable(
  "verification_jobs",
  {
    submissionSequence: integer("submission_sequence").notNull().default(0),
    protocolVersion: integer("protocol_version").notNull().default(1),
    id: uuid("id").primaryKey().defaultRandom(),
    escrowAddress: text("escrow_address").notNull(),
    pactId: text("pact_id").notNull(),
    milestoneIndex: integer("milestone_index").notNull(),
    deliverableHash: text("deliverable_hash").notNull(),
    deliverableUri: text("deliverable_uri").notNull(),
    rulesHash: text("rules_hash").notNull(),
    status: text("status").notNull().default("QUEUED"),
    score: integer("score"),
    passed: boolean("passed"),
    verifierAddress: text("verifier_address"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("verification_jobs_submission_unique").on(
      table.escrowAddress,
      table.milestoneIndex,
      table.submissionSequence,
      table.deliverableHash,
      table.rulesHash,
    ),
  ],
);

export const verificationRuleResults = pgTable(
  "verification_rule_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => verificationJobs.id),
    ruleId: text("rule_id").notNull(),
    ruleType: text("rule_type").notNull(),
    required: boolean("required").notNull(),
    weight: integer("weight").notNull(),
    passed: boolean("passed").notNull(),
    score: integer("score").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("verification_rule_results_job_rule_unique").on(
      table.jobId,
      table.ruleId,
    ),
  ],
);

export const verificationReports = pgTable("verification_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .unique()
    .references(() => verificationJobs.id),
  canonicalReport: jsonb("canonical_report").notNull(),
  reportHash: text("report_hash").notNull(),
  reportUri: text("report_uri").notNull(),
  eip712Digest: text("eip712_digest"),
  signature: text("signature"),
  rawTransaction: text("raw_transaction"),
  attestationTxHash: text("attestation_tx_hash"),
  attestationBlock: bigint("attestation_block", { mode: "number" }),
  nonce: text("nonce").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verifiers = pgTable("verifiers", {
  address: text("address").primaryKey(),
  metadata: jsonb("metadata").notNull(),
  metadataHash: text("metadata_hash").notNull(),
  registrationTxHash: text("registration_tx_hash"),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default(""),
  bio: text("bio").notNull().default(""),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  category: text("category").notNull().default("Development"),
  intent: text("intent").notNull().default("BOTH"),
  demo: boolean("demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const wallets = pgTable("wallets", {
  address: text("address").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  address: text("address").notNull(),
  message: text("message").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
});
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  address: text("address").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const googleChallenges = pgTable("google_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  nonce: text("nonce").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
});
export const accountSessions = pgTable("account_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  subject: text("subject").notNull(),
  name: text("name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export type JobMilestone = { title: string; amount: string; dueAt: string };
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements").notNull().default(""),
  category: text("category").notNull(),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  budget: text("budget").notNull(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  milestones: jsonb("milestones").$type<JobMilestone[]>().notNull(),
  verificationMode: text("verification_mode").notNull(),
  policy: jsonb("policy"),
  clientDeposit: text("client_deposit").notNull(),
  workerDeposit: text("worker_deposit").notNull(),
  status: text("status").notNull().default("DRAFT"),
  demo: boolean("demo").notNull().default(false),
  escrowAddress: text("escrow_address").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => users.id),
    workerAddress: text("worker_address").notNull(),
    message: text("message").notNull(),
    estimatedDays: integer("estimated_days").notNull(),
    acceptBudget: boolean("accept_budget").notNull(),
    milestones: jsonb("milestones"),
    status: text("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("proposal_job_worker_unique").on(table.jobId, table.workerId),
  ],
);
export const milestones = pgTable("milestones", {
  id: text("id").primaryKey(),
  escrowAddress: text("escrow_address")
    .notNull()
    .references(() => pacts.address),
  index: integer("index").notNull(),
  snapshot: jsonb("snapshot").notNull(),
});
export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: text("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockHash: text("block_hash").notNull(),
    address: text("address").notNull(),
    name: text("name").notNull(),
    args: jsonb("args").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("chain_log_unique").on(
      table.chainId,
      table.txHash,
      table.logIndex,
    ),
  ],
);
export const reputationSnapshots = pgTable("reputation_snapshots", {
  address: text("address").primaryKey(),
  metrics: jsonb("metrics").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const actorRelationships = pgTable("actor_relationships", {
  id: text("id").primaryKey(),
  actorA: text("actor_a").notNull(),
  actorB: text("actor_b").notNull(),
  completedPacts: integer("completed_pacts").notNull(),
  settledVolume: text("settled_volume").notNull(),
  disputes: integer("disputes").notNull(),
  lastCollaborationAt: timestamp("last_collaboration_at", {
    withTimezone: true,
  }).notNull(),
});
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  href: text("href").notNull(),
  title: text("title").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const analytics = pgTable("analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  event: text("event").notNull(),
  properties: jsonb("properties").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const indexerCursors = pgTable("indexer_cursors", {
  chainId: integer("chain_id").primaryKey(),
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pactSpecs = pgTable("pact_specs", {
  escrowAddress: text("escrow_address").primaryKey(),
  version: integer("version").notNull().default(2),
  spec: jsonb("spec").notNull(),
  specHash: text("spec_hash").notNull(),
  client: text("client").notNull(),
  worker: text("worker"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    escrowAddress: text("escrow_address").notNull(),
    milestoneIndex: integer("milestone_index").notNull(),
    sequence: integer("sequence").notNull(),
    submittedBy: text("submitted_by").notNull(),
    manifest: jsonb("manifest").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    reference: text("reference").notNull(),
    txHash: text("tx_hash"),
    status: text("status").notNull().default("PREPARED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("submissions_sequence_unique").on(
      t.escrowAddress,
      t.milestoneIndex,
      t.sequence,
    ),
  ],
);
export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => submissions.id),
  type: text("type").notNull(),
  source: text("source").notNull(),
  label: text("label").notNull(),
  submittedBy: text("submitted_by").notNull(),
  contentHash: text("content_hash").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  visibility: text("visibility").notNull().default("PARTICIPANTS"),
  status: text("status").notNull().default("READY"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  escrowAddress: text("escrow_address"),
  actor: text("actor").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const publicDisclosures = pgTable("public_disclosures", {
  escrowAddress: text("escrow_address").primaryKey(),
  publicId: uuid("public_id").notNull().unique().defaultRandom(),
  payload: jsonb("payload").notNull(),
  payloadHash: text("payload_hash").notNull(),
  clientApproved: boolean("client_approved").notNull().default(false),
  workerApproved: boolean("worker_approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner: text("owner").notNull(),
  objectKey: text("object_key").notNull().unique(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  contentHash: text("content_hash").notNull(),
  status: text("status").notNull().default("QUARANTINED"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
