ALTER TABLE "exercise" ADD COLUMN "is_exam" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_exam_window_valid" CHECK (NOT "exercise"."is_exam" OR ("exercise"."opens_at" IS NOT NULL AND "exercise"."closes_at" IS NOT NULL AND "exercise"."closes_at" > "exercise"."opens_at"));
--> statement-breakpoint
CREATE TABLE "exam_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"group_member_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"submission_id" uuid,
	CONSTRAINT "exam_attempt_member_number_unique" UNIQUE("exercise_id","group_member_id","attempt_number"),
	CONSTRAINT "exam_attempt_submission_unique" UNIQUE("submission_id"),
	CONSTRAINT "exam_attempt_number_valid" CHECK ("exam_attempt"."attempt_number" > 0),
	CONSTRAINT "exam_attempt_expiry_valid" CHECK ("exam_attempt"."expires_at" > "exam_attempt"."started_at")
);
--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "max_attempts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_group_member_id_fkey" FOREIGN KEY ("group_member_id") REFERENCES "public"."groupmember"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt" ADD CONSTRAINT "exam_attempt_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_max_attempts_valid" CHECK ("exercise"."max_attempts" > 0);--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_duration_minutes_valid" CHECK ("exercise"."duration_minutes" IS NULL OR "exercise"."duration_minutes" > 0);
