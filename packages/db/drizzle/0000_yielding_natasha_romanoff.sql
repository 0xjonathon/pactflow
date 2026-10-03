CREATE TABLE "pacts" (
	"address" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"client" text NOT NULL,
	"worker" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_address" text NOT NULL,
	"pact_id" text NOT NULL,
	"milestone_index" integer NOT NULL,
	"deliverable_hash" text NOT NULL,
	"deliverable_uri" text NOT NULL,
	"rules_hash" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"score" integer,
	"passed" boolean,
	"verifier_address" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pact_id" text NOT NULL,
	"escrow_address" text NOT NULL,
	"milestone_index" integer NOT NULL,
	"version" integer NOT NULL,
	"policy" jsonb NOT NULL,
	"rules_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"canonical_report" jsonb NOT NULL,
	"report_hash" text NOT NULL,
	"report_uri" text NOT NULL,
	"eip712_digest" text,
	"signature" text,
	"attestation_tx_hash" text,
	"attestation_block" bigint,
	"nonce" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_reports_job_id_unique" UNIQUE("job_id"),
	CONSTRAINT "verification_reports_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE "verification_rule_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"rule_type" text NOT NULL,
	"required" boolean NOT NULL,
	"weight" integer NOT NULL,
	"passed" boolean NOT NULL,
	"score" integer NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifiers" (
	"address" text PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL,
	"metadata_hash" text NOT NULL,
	"registration_tx_hash" text,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_job_id_verification_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."verification_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_rule_results" ADD CONSTRAINT "verification_rule_results_job_id_verification_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."verification_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_jobs_submission_unique" ON "verification_jobs" USING btree ("escrow_address","milestone_index","deliverable_hash","rules_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_policies_escrow_milestone_hash_unique" ON "verification_policies" USING btree ("escrow_address","milestone_index","rules_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_rule_results_job_rule_unique" ON "verification_rule_results" USING btree ("job_id","rule_id");