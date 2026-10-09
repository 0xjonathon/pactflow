CREATE TABLE "account_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"name" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
UPDATE "users"
SET "display_name" = 'Guest-' || upper(substr(md5("id"::text), 1, 6))
WHERE "display_name" = 'New member'
  AND "handle" LIKE 'member-%'
  AND "role" = '' AND "bio" = '' AND "skills" = '[]'::jsonb
  AND "demo" = false;
