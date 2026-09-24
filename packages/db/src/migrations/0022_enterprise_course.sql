ALTER TABLE "course" ADD COLUMN "difficulty" varchar(16);--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "learning_minutes" integer;--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "credit" double precision;--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "target_audience" text;--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "required" boolean;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_difficulty_valid" CHECK ("course"."difficulty" IS NULL OR "course"."difficulty" IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'));--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_learning_minutes_nonnegative" CHECK ("course"."learning_minutes" IS NULL OR "course"."learning_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_credit_nonnegative" CHECK ("course"."credit" IS NULL OR "course"."credit" >= 0);