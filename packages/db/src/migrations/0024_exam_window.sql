ALTER TABLE "exercise" ADD COLUMN "is_exam" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_exam_window_valid" CHECK (NOT "exercise"."is_exam" OR ("exercise"."opens_at" IS NOT NULL AND "exercise"."closes_at" IS NOT NULL AND "exercise"."closes_at" > "exercise"."opens_at"));