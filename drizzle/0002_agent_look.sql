CREATE TYPE "public"."avatar_shape" AS ENUM('drop', 'square', 'round', 'blob');--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "shape" "avatar_shape" DEFAULT 'round' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "color" text DEFAULT '#2f80ff' NOT NULL;--> statement-breakpoint
-- The setup agents made before looks existed get the Acme Bot's.
UPDATE "agent" SET "shape" = 'drop', "color" = '#9eea6c' WHERE "kind" = 'setup';