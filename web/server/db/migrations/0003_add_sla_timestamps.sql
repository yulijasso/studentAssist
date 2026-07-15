ALTER TABLE "conversations" ADD COLUMN "first_response_at" timestamp with time zone;
ALTER TABLE "conversations" ADD COLUMN "resolved_at" timestamp with time zone;
ALTER TABLE "conversations" ADD COLUMN "escalated_at" timestamp with time zone;
