ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "escalation_contact" json;--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "escalation_phone";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "escalation_email";
