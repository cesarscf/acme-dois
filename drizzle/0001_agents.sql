CREATE TYPE "public"."agent_kind" AS ENUM('setup', 'team');--> statement-breakpoint
CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"kind" "agent_kind" NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"instructions" text NOT NULL,
	"tools" text[] NOT NULL,
	"acts_alone" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_profile" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"about" text NOT NULL,
	"appointment_minutes" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "message_member_idx";--> statement-breakpoint
DROP INDEX "transcript_member_idx";--> statement-breakpoint
-- Conversations so far were with an agent fixed in code, which no row stands for.
DELETE FROM "message";--> statement-breakpoint
DELETE FROM "transcript_entry";--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript_entry" ADD COLUMN "agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_profile" ADD CONSTRAINT "organization_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_setup_idx" ON "agent" USING btree ("organization_id") WHERE "agent"."kind" = 'setup';--> statement-breakpoint
CREATE UNIQUE INDEX "agent_name_idx" ON "agent" USING btree ("organization_id",lower("name"));--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_entry" ADD CONSTRAINT "transcript_entry_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("member_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "transcript_conversation_idx" ON "transcript_entry" USING btree ("member_id","agent_id","seq");--> statement-breakpoint
-- Organizations created before agents existed get their setup agent too.
INSERT INTO "agent" ("organization_id", "kind", "name", "role", "instructions", "tools", "acts_alone")
SELECT "id", 'setup', 'Acme Bot', 'Configura a sua equipe de agentes', '', '{}', '{}' FROM "organization";