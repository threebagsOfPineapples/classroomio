ALTER TABLE "lesson_completion" ADD COLUMN IF NOT EXISTS "reading_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_completion" ADD COLUMN IF NOT EXISTS "reading_last_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lesson_completion" ADD COLUMN IF NOT EXISTS "reading_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_completion" ADD COLUMN IF NOT EXISTS "reading_resources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "reminded_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "reminder_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exam_makeup" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "exercise_id" uuid NOT NULL CONSTRAINT "exam_makeup_exercise_id_exercise_id_fk" REFERENCES "exercise"("id") ON DELETE CASCADE,
  "group_member_id" uuid NOT NULL CONSTRAINT "exam_makeup_group_member_id_groupmember_id_fk" REFERENCES "groupmember"("id") ON DELETE CASCADE,
  "opens_at" timestamp with time zone NOT NULL,
  "closes_at" timestamp with time zone NOT NULL,
  "max_attempts" integer NOT NULL,
  "granted_by" uuid NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "exam_makeup_member_unique" UNIQUE ("exercise_id", "group_member_id")
);
