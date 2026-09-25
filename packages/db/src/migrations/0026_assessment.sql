CREATE TABLE "assessment_adjustment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"score_id" uuid NOT NULL,
	"amount" double precision NOT NULL,
	"reason" text NOT NULL,
	"adjusted_by_profile_id" uuid NOT NULL,
	"adjusted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_adjustment_amount_valid" CHECK ("assessment_adjustment"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_input" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"entered_by_profile_id" uuid NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_input_score_valid" CHECK ("assessment_input"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"name" varchar(200) NOT NULL,
	"weight" integer NOT NULL,
	"max_score" double precision NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"sort" integer NOT NULL,
	"exercise_id" uuid,
	CONSTRAINT "assessment_item_type_valid" CHECK ("assessment_item"."type" IN ('EXAM', 'ASSIGNMENT', 'INSTRUCTOR', 'ATTENDANCE', 'PROGRESS', 'CUSTOM')),
	CONSTRAINT "assessment_item_weight_valid" CHECK ("assessment_item"."weight" BETWEEN 0 AND 100),
	CONSTRAINT "assessment_item_max_score_valid" CHECK ("assessment_item"."max_score" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_scheme" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"pass_score" integer NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_scheme_plan_unique" UNIQUE("plan_id"),
	CONSTRAINT "assessment_scheme_pass_score_valid" CHECK ("assessment_scheme"."pass_score" BETWEEN 0 AND 100),
	CONSTRAINT "assessment_scheme_status_valid" CHECK ("assessment_scheme"."status" IN ('DRAFT', 'PUBLISHED'))
);
--> statement-breakpoint
CREATE TABLE "assessment_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"raw_calculated_score" double precision,
	"manual_adjustment" double precision DEFAULT 0 NOT NULL,
	"final_score" double precision,
	"result" "TRAINING_RESULT" DEFAULT 'PENDING' NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_score_enrollment_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "assessment_score_final_valid" CHECK ("assessment_score"."final_score" IS NULL OR "assessment_score"."final_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "assessment_score_detail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"score_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"source_id" uuid,
	"raw_score" double precision,
	"max_score" double precision NOT NULL,
	"normalized_score" double precision,
	"weight" integer NOT NULL,
	"weighted_score" double precision,
	CONSTRAINT "assessment_score_detail_item_unique" UNIQUE("score_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "training_evaluation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"content_rating" integer NOT NULL,
	"instructor_rating" integer NOT NULL,
	"usefulness_rating" integer NOT NULL,
	"difficulty_rating" integer NOT NULL,
	"satisfaction_rating" integer NOT NULL,
	"helpful_content" text,
	"improvements" text,
	"suggestions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_evaluation_enrollment_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "training_evaluation_content_valid" CHECK ("training_evaluation"."content_rating" BETWEEN 1 AND 5),
	CONSTRAINT "training_evaluation_instructor_valid" CHECK ("training_evaluation"."instructor_rating" BETWEEN 1 AND 5),
	CONSTRAINT "training_evaluation_usefulness_valid" CHECK ("training_evaluation"."usefulness_rating" BETWEEN 1 AND 5),
	CONSTRAINT "training_evaluation_difficulty_valid" CHECK ("training_evaluation"."difficulty_rating" BETWEEN 1 AND 5),
	CONSTRAINT "training_evaluation_satisfaction_valid" CHECK ("training_evaluation"."satisfaction_rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "assessment_adjustment" ADD CONSTRAINT "assessment_adjustment_score_fkey" FOREIGN KEY ("score_id") REFERENCES "public"."assessment_score"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_adjustment" ADD CONSTRAINT "assessment_adjustment_profile_fkey" FOREIGN KEY ("adjusted_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_input" ADD CONSTRAINT "assessment_input_enrollment_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_input" ADD CONSTRAINT "assessment_input_item_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."assessment_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_input" ADD CONSTRAINT "assessment_input_profile_fkey" FOREIGN KEY ("entered_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_item" ADD CONSTRAINT "assessment_item_scheme_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."assessment_scheme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_item" ADD CONSTRAINT "assessment_item_exercise_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_scheme" ADD CONSTRAINT "assessment_scheme_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score" ADD CONSTRAINT "assessment_score_enrollment_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score_detail" ADD CONSTRAINT "assessment_score_detail_score_fkey" FOREIGN KEY ("score_id") REFERENCES "public"."assessment_score"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score_detail" ADD CONSTRAINT "assessment_score_detail_item_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."assessment_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_evaluation" ADD CONSTRAINT "training_evaluation_enrollment_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_adjustment_score_idx" ON "assessment_adjustment" USING btree ("score_id");--> statement-breakpoint
CREATE INDEX "assessment_input_enrollment_item_idx" ON "assessment_input" USING btree ("enrollment_id","item_id");--> statement-breakpoint
CREATE INDEX "assessment_item_scheme_idx" ON "assessment_item" USING btree ("scheme_id");
--> statement-breakpoint
ALTER TYPE "public"."LOCALE" ADD VALUE 'zh';
