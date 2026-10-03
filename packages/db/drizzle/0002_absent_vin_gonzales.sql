CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_address" text,
	"actor" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"label" text NOT NULL,
	"submitted_by" text NOT NULL,
	"content_hash" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text DEFAULT 'PARTICIPANTS' NOT NULL,
	"status" text DEFAULT 'READY' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pact_specs" (
	"escrow_address" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 2 NOT NULL,
	"spec" jsonb NOT NULL,
	"spec_hash" text NOT NULL,
	"client" text NOT NULL,
	"worker" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_disclosures" (
	"escrow_address" text PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"client_approved" boolean DEFAULT false NOT NULL,
	"worker_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_disclosures_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_address" text NOT NULL,
	"milestone_index" integer NOT NULL,
	"sequence" integer NOT NULL,
	"submitted_by" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"manifest_hash" text NOT NULL,
	"reference" text NOT NULL,
	"tx_hash" text,
	"status" text DEFAULT 'PREPARED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" text NOT NULL,
	"object_key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"content_hash" text NOT NULL,
	"status" text DEFAULT 'QUARANTINED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
DROP INDEX "verification_jobs_submission_unique";--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD COLUMN "submission_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD COLUMN "protocol_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_sequence_unique" ON "submissions" USING btree ("escrow_address","milestone_index","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_jobs_submission_unique" ON "verification_jobs" USING btree ("escrow_address","milestone_index","submission_sequence","deliverable_hash","rules_hash");