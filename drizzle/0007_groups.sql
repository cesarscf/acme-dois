CREATE TABLE "chat_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"general" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_group_agent" (
	"group_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	CONSTRAINT "chat_group_agent_group_id_agent_id_pk" PRIMARY KEY("group_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "chat_group_member" (
	"group_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	CONSTRAINT "chat_group_member_group_id_member_id_pk" PRIMARY KEY("group_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "group_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"author" "message_author" NOT NULL,
	"member_id" text,
	"agent_id" uuid,
	"text" text,
	"card" jsonb,
	"action" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_read" (
	"member_id" text NOT NULL,
	"group_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "group_read_member_id_group_id_pk" PRIMARY KEY("member_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "group_transcript_entry" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"entry" jsonb NOT NULL,
	"read_up_to" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chat_group" ADD CONSTRAINT "chat_group_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group" ADD CONSTRAINT "chat_group_created_by_member_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group_agent" ADD CONSTRAINT "chat_group_agent_group_id_chat_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group_agent" ADD CONSTRAINT "chat_group_agent_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group_member" ADD CONSTRAINT "chat_group_member_group_id_chat_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_group_member" ADD CONSTRAINT "chat_group_member_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message" ADD CONSTRAINT "group_message_group_id_chat_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message" ADD CONSTRAINT "group_message_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message" ADD CONSTRAINT "group_message_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_read" ADD CONSTRAINT "group_read_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_read" ADD CONSTRAINT "group_read_group_id_chat_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_transcript_entry" ADD CONSTRAINT "group_transcript_entry_group_id_chat_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_transcript_entry" ADD CONSTRAINT "group_transcript_entry_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_group_general_idx" ON "chat_group" USING btree ("organization_id") WHERE "chat_group"."general";--> statement-breakpoint
CREATE UNIQUE INDEX "chat_group_name_idx" ON "chat_group" USING btree ("organization_id",lower("name"));--> statement-breakpoint
CREATE INDEX "chat_group_member_idx" ON "chat_group_member" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "group_message_group_idx" ON "group_message" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "group_transcript_idx" ON "group_transcript_entry" USING btree ("group_id","agent_id","seq");--> statement-breakpoint
INSERT INTO "chat_group" ("organization_id", "name", "general", "created_at") SELECT "id", 'geral', true, now() FROM "organization" ON CONFLICT DO NOTHING;
