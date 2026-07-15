ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "auto_resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "escalation_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "escalation_email" varchar(255);
