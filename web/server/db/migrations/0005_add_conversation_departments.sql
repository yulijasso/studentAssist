CREATE TABLE IF NOT EXISTS "conversation_departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "trigger_message_id" uuid,
  "reason" text,
  CONSTRAINT "conversation_departments_conv_dept_unique"
    UNIQUE ("conversation_id", "department_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_departments"
  ADD CONSTRAINT "cd_conversation_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
  ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "conversation_departments"
  ADD CONSTRAINT "cd_department_id_fk"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "conversation_departments"
  ADD CONSTRAINT "cd_trigger_message_id_fk"
  FOREIGN KEY ("trigger_message_id") REFERENCES "messages"("id")
  ON DELETE SET NULL;
