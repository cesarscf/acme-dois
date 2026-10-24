CREATE TABLE "conversation_read" (
	"member_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "conversation_read_member_id_agent_id_pk" PRIMARY KEY("member_id","agent_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_read" ADD CONSTRAINT "conversation_read_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_read" ADD CONSTRAINT "conversation_read_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;